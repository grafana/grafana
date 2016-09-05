package graphite

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	HttpClient = http.Client{Timeout: time.Duration(10 * time.Second)}
)

type GraphiteExecutor struct {
	*tsdb.DataSourceInfo
}

func NewGraphiteExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &GraphiteExecutor{dsInfo}
}

var glog log.Logger

func init() {
	glog = log.New("tsdb.graphite")
	tsdb.RegisterExecutor("graphite", NewGraphiteExecutor)
}

func (e *GraphiteExecutor) Execute(queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	formData := url.Values{
		"from":          []string{"-" + formatTimeRange(context.TimeRange.From)},
		"until":         []string{formatTimeRange(context.TimeRange.To)},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	for _, query := range queries {
		formData["target"] = []string{query.Query}
	}

	glog.Info("Graphite request body", "formdata", formData.Encode())

	req, err := e.createRequest(formData)
	if err != nil {
		result.Error = err
		return result
	}
	res, err := HttpClient.Do(req)
	if err != nil {
		result.Error = err
		return result
	}

	data, err := e.parseResponse(res)
	if err != nil {
		result.Error = err
		return result
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	queryRes := &tsdb.QueryResult{}
	for _, series := range data {
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   series.Target,
			Points: series.DataPoints,
		})
	}

	result.QueryResults["A"] = queryRes
	return result
}

func (e *GraphiteExecutor) parseResponse(res *http.Response) ([]TargetResponseDTO, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode == http.StatusUnauthorized {
		glog.Info("Request is Unauthorized", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request is Unauthorized status: %v body: %s", res.Status, string(body))
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	return data, nil
}

func (e *GraphiteExecutor) createRequest(data url.Values) (*http.Request, error) {
	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(data.Encode()))
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	return req, err
}

func formatTimeRange(input string) string {
	if input == "now" {
		return input
	}
	return strings.Replace(strings.Replace(input, "m", "min", -1), "M", "mon", -1)
}

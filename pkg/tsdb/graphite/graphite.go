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

	params := url.Values{
		"from":          []string{"-" + formatTimeRange(context.TimeRange.From)},
		"until":         []string{formatTimeRange(context.TimeRange.To)},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	for _, query := range queries {
		params["target"] = []string{query.Query}
	}

	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "render")
	glog.Info("Graphite request body", "formdata", params.Encode())

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(params.Encode()))
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		result.Error = fmt.Errorf("Failed to create request. error: %v", err)
		return result
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	res, err := HttpClient.Do(req)
	if err != nil {
		result.Error = err
		return result
	}

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		result.Error = err
		return result
	}

	if res.StatusCode == http.StatusUnauthorized {
		glog.Info("Request is Unauthorized", "status", res.Status, "body", string(body))
		result.Error = fmt.Errorf("Request is Unauthorized status: %v body: %s", res.Status, string(body))
		return result
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
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

func formatTimeRange(input string) string {
	if input == "now" {
		return input
	}
	return strings.Replace(strings.Replace(input, "m", "min", -1), "M", "mon", -1)
}

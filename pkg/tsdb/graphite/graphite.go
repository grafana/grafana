package graphite

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type GraphiteExecutor struct {
	*tsdb.DataSourceInfo
}

func NewGraphiteExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &GraphiteExecutor{dsInfo}
}

var (
	glog       log.Logger
	HttpClient *http.Client
)

func init() {
	glog = log.New("tsdb.graphite")
	tsdb.RegisterExecutor("graphite", NewGraphiteExecutor)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	HttpClient = &http.Client{
		Timeout:   time.Duration(15 * time.Second),
		Transport: tr,
	}
}

func (e *GraphiteExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	formData := url.Values{
		"from":          []string{"-" + formatTimeRange(context.TimeRange.From)},
		"until":         []string{formatTimeRange(context.TimeRange.To)},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	for _, query := range queries {
		if fullTarget, err := query.Model.Get("targetFull").String(); err == nil {
			formData["target"] = []string{fullTarget}
		} else {
			formData["target"] = []string{query.Model.Get("target").MustString()}
		}
	}

	if setting.Env == setting.DEV {
		glog.Debug("Graphite request", "params", formData)
	}

	req, err := e.createRequest(formData)
	if err != nil {
		result.Error = err
		return result
	}

	res, err := ctxhttp.Do(ctx, HttpClient, req)
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
	queryRes := tsdb.NewQueryResult()

	for _, series := range data {
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   series.Target,
			Points: series.DataPoints,
		})

		if setting.Env == setting.DEV {
			glog.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
		}
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

	if res.StatusCode/100 != 2 {
		glog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
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

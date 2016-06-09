package graphite

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
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
		"from":          []string{context.TimeRange.From},
		"until":         []string{context.TimeRange.To},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	for _, query := range queries {
		params["target"] = []string{
			query.Query,
		}
	}

	client := http.Client{Timeout: time.Duration(10 * time.Second)}
	res, err := client.PostForm(e.Url+"/render?", params)
	if err != nil {
		result.Error = err
		return result
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		result.Error = err
		return result
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err)
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

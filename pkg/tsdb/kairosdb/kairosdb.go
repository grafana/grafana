package kairosdb

import (
	"context"
	"fmt"
	"path"
	"strings"

	"golang.org/x/net/context/ctxhttp"

	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/url"

	"gopkg.in/guregu/null.v3"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type KairosDbExecutor struct {
	*models.DataSource
	MetricParser    *KairosDbMetricParser
	httpClient *http.Client
}

func NewKairosDbExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	httpClient, err := datasource.GetHttpClient()

	if err != nil {
		return nil, err
	}

	return &KairosDbExecutor{
		DataSource: datasource,
		MetricParser: &KairosDbMetricParser{},
		httpClient: httpClient,
	}, nil
}

var (
	plog log.Logger
)

func init() {
	plog = log.New("tsdb.kairosdb")
	tsdb.RegisterExecutor("kairosdb", NewKairosDbExecutor)
}

func (e *KairosDbExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	var tsdbQuery KairosDbQuery

	tsdbQuery.Start = queryContext.TimeRange.GetFromAsMsEpoch()
	tsdbQuery.End = queryContext.TimeRange.GetToAsMsEpoch()

	for _, query := range queries {
		metric := e.MetricParser.Parse(query.Model)
		tsdbQuery.Metric = append(tsdbQuery.Metric, metric)
	}

	if setting.Env == setting.DEV {
		plog.Debug("KairosDbdb request", "params", tsdbQuery)
	}

	req, err := e.createRequest(tsdbQuery)
	if err != nil {
		result.Error = err
		return result
	}

	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		result.Error = err
		return result
	}

	queryResult, err := e.parseResponse(tsdbQuery, res)
	if err != nil {
		return result.WithError(err)
	}

	result.QueryResults = queryResult
	return result
}

func (e *KairosDbExecutor) createRequest(data KairosDbQuery) (*http.Request, error) {
	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "api/v1/datapoints/query")

	postData, err := json.Marshal(data)

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(string(postData)))
	if err != nil {
		plog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	return req, err
}

func (e *KairosDbExecutor) parseResponse(query KairosDbQuery, res *http.Response) (map[string]*tsdb.QueryResult, error) {

	queryResults := make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		plog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	// var data []KairosDbResponse
	data := KairosDbResponse{}
	err = json.Unmarshal(body, &data)
	if err != nil {
		plog.Info("Failed to unmarshal kairos response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}
	
	for  _, val := range data.Queries {

		for _,results := range val.Results{

			series := tsdb.TimeSeries{
				Name: results.Name,
			}

			for _, value := range results.Values {
				timestamp := value[0]
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(value[1])), timestamp))
				plog.Info("added series point","series","series")
			}

			queryRes.Series = append(queryRes.Series, &series)
		}
	}

	queryResults["A"] = queryRes
	return queryResults, nil
}


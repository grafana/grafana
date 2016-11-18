package mqe

import (
	"context"
	"net/http"
	"net/url"
	"path"
	"strings"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

/*

  TODO:
  * response serie names
  * response serie names with tags
  * response serie names with wildcards
  * real caching

*/

type MQEExecutor struct {
	*tsdb.DataSourceInfo
	QueryParser    *MQEQueryParser
	ResponseParser *MQEResponseParser
}

func NewMQEExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &MQEExecutor{
		DataSourceInfo: dsInfo,
		QueryParser:    &MQEQueryParser{},
		ResponseParser: &MQEResponseParser{},
	}
}

var (
	glog       log.Logger
	HttpClient *http.Client
)

func init() {
	glog = log.New("tsdb.mqe")
	tsdb.RegisterExecutor("mqe-datasource", NewMQEExecutor)

	HttpClient = tsdb.GetDefaultClient()
}

type QueryToSend struct {
	RawQuery string
	QueryRef *MQEQuery
}

func (e *MQEExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	availableSeries, err := NewTokenClient().GetTokenData(ctx, e.DataSourceInfo)
	if err != nil {
		return result.WithError(err)
	}

	var mqeQueries []*MQEQuery
	for _, v := range queries {
		q, err := e.QueryParser.Parse(v.Model, e.DataSourceInfo, queryContext)
		if err != nil {
			return result.WithError(err)
		}
		mqeQueries = append(mqeQueries, q)
	}

	var rawQueries []QueryToSend
	for _, v := range mqeQueries {
		queries, err := v.Build(availableSeries.Metrics)
		if err != nil {
			return result.WithError(err)
		}

		rawQueries = append(rawQueries, queries...)
	}

	queryResult := &tsdb.QueryResult{}
	for _, v := range rawQueries {
		glog.Info("Mqe executor", "query", v)

		req, err := e.createRequest(v.RawQuery)

		resp, err := ctxhttp.Do(ctx, HttpClient, req)
		if err != nil {
			return result.WithError(err)
		}

		series, err := e.ResponseParser.Parse(resp, v.QueryRef)
		if err != nil {
			return result.WithError(err)
		}

		queryResult.Series = append(queryResult.Series, series.Series...)
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	result.QueryResults["A"] = queryResult

	return result
}

func (e *MQEExecutor) createRequest(query string) (*http.Request, error) {
	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "query")

	payload := simplejson.New()
	payload.Set("query", query)

	jsonPayload, err := payload.MarshalJSON()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(string(jsonPayload)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	glog.Debug("Mqe request", "url", req.URL.String())
	return req, nil
}

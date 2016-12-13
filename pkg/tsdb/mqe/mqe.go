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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

/*
  TODO:
  * response serie names with wildcards
  * real caching
*/

type MQEExecutor struct {
	*models.DataSource
	queryParser    *MQEQueryParser
	responseParser *MQEResponseParser
	httpClient     *http.Client
	log            log.Logger
	tokenClient    *TokenClient
}

func NewMQEExecutor(dsInfo *models.DataSource) (tsdb.Executor, error) {
	httpclient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &MQEExecutor{
		DataSource:     dsInfo,
		httpClient:     httpclient,
		log:            log.New("tsdb.mqe"),
		queryParser:    NewQueryParser(),
		responseParser: NewResponseParser(),
		tokenClient:    NewTokenClient(dsInfo),
	}, nil
}

func init() {
	tsdb.RegisterExecutor("mqe-datasource", NewMQEExecutor)
}

type QueryToSend struct {
	RawQuery string
	QueryRef *MQEQuery
}

func (e *MQEExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	availableSeries, err := e.tokenClient.GetTokenData(ctx)
	if err != nil {
		return result.WithError(err)
	}

	var mqeQueries []*MQEQuery
	for _, v := range queries {
		q, err := e.queryParser.Parse(v.Model, e.DataSource, queryContext)
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
		e.log.Info("Mqe executor", "query", v)

		req, err := e.createRequest(v.RawQuery)

		resp, err := ctxhttp.Do(ctx, e.httpClient, req)
		if err != nil {
			return result.WithError(err)
		}

		series, err := e.responseParser.Parse(resp, v.QueryRef)
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

	e.log.Debug("Mqe request", "url", req.URL.String())
	return req, nil
}

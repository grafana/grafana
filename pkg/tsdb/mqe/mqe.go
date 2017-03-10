package mqe

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEExecutor struct {
	*models.DataSource
	queryParser *QueryParser
	apiClient   *apiClient
	httpClient  *http.Client
	log         log.Logger
	tokenClient *TokenClient
}

func NewMQEExecutor(dsInfo *models.DataSource) (tsdb.Executor, error) {
	httpclient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &MQEExecutor{
		DataSource:  dsInfo,
		httpClient:  httpclient,
		log:         log.New("tsdb.mqe"),
		queryParser: NewQueryParser(),
		apiClient:   NewApiClient(httpclient, dsInfo),
		tokenClient: NewTokenClient(dsInfo),
	}, nil
}

func init() {
	tsdb.RegisterExecutor("mqe-datasource", NewMQEExecutor)
}

type QueryToSend struct {
	RawQuery string
	Metric   Metric
	QueryRef *Query
}

func (e *MQEExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	availableSeries, err := e.tokenClient.GetTokenData(ctx)
	if err != nil {
		return result.WithError(err)
	}

	var mqeQueries []*Query
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

	e.log.Debug("Sending request", "url", e.DataSource.Url)

	queryResult, err := e.apiClient.PerformRequests(ctx, rawQueries)
	if err != nil {
		return result.WithError(err)
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	result.QueryResults["A"] = queryResult

	return result
}

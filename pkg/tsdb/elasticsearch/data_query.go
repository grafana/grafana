package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

const (
	defaultSize = 500
)

type elasticsearchDataQuery struct {
	client                       es.Client
	dataQueries                  []backend.DataQuery
	logger                       log.Logger
	ctx                          context.Context
	keepLabelsInResponse         bool
	aggregationParserDSLRawQuery AggregationParser
}

var newElasticsearchDataQuery = func(ctx context.Context, client es.Client, req *backend.QueryDataRequest, logger log.Logger) *elasticsearchDataQuery {
	_, fromAlert := req.Headers[headerFromAlert]
	fromExpression := req.GetHTTPHeader(headerFromExpression) != ""

	return &elasticsearchDataQuery{
		client:      client,
		dataQueries: req.Queries,
		logger:      logger,
		ctx:         ctx,
		// To maintain backward compatibility, it is necessary to keep labels in responses for alerting and expressions queries.
		// Historically, these labels have been used in alerting rules and transformations.
		keepLabelsInResponse: fromAlert || fromExpression,

		aggregationParserDSLRawQuery: NewAggregationParser(),
	}
}

func (e *elasticsearchDataQuery) execute() (*backend.QueryDataResponse, error) {
	start := time.Now()
	response := backend.NewQueryDataResponse()
	e.logger.Debug("Parsing queries", "queriesLength", len(e.dataQueries))
	queries, err := parseQuery(e.dataQueries, e.logger)
	if err != nil {
		mq, _ := json.Marshal(e.dataQueries)
		e.logger.Error("Failed to parse queries", "error", err, "queries", string(mq), "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	// Separate ES|QL queries from regular queries.
	// ES|QL queries must be handled separately because they:
	// 1. Use a different endpoint: /_query (single query) vs /_msearch (batch)
	// 2. Have a different request format: {"query": "..."} vs NDJSON with headers
	// 3. Have a different response format: {columns, values} vs {aggregations, hits}
	// 4. Cannot be batched together like regular queries
	//
	// In contrast, Raw DSL queries (QueryLanguage == "raw_dsl") still use the /_msearch
	// endpoint and the same response format, so they can be processed together
	// with other regular queries in processQuery().
	var regularQueries []*Query
	var esqlQueries []*Query
	for _, q := range queries {
		if q.IsEsqlQuery() {
			esqlQueries = append(esqlQueries, q)
		} else {
			regularQueries = append(regularQueries, q)
		}
	}

	// Execute ES|QL queries individually (each requires a separate HTTP call to /_query)
	for _, q := range esqlQueries {
		esqlResponse, err := e.executeEsqlQuery(q)
		if err != nil {
			response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		response.Responses[q.RefID] = *esqlResponse
	}

	// Execute regular queries as a batch via /_msearch
	if len(regularQueries) > 0 {
		regularResponse, err := e.executeRegularQueries(regularQueries, start)
		if err != nil {
			return response, nil
		}
		for refID, resp := range regularResponse.Responses {
			response.Responses[refID] = resp
		}
	}

	return response, nil
}

func (e *elasticsearchDataQuery) executeEsqlQuery(q *Query) (*backend.DataResponse, error) {
	if q.EsqlQuery == "" {
		return nil, backend.DownstreamError(fmt.Errorf("ES|QL query is empty"))
	}

	e.logger.Debug("Executing ES|QL query", "query", q.EsqlQuery, "refID", q.RefID)

	esqlRes, err := e.client.ExecuteEsql(q.EsqlQuery)
	if err != nil {
		return nil, err
	}

	// Process the ES|QL response based on the metric type, similar to how
	// the "code" editor type handles different metric types (logs, raw_data, raw_document, etc.)
	configuredFields := e.client.GetConfiguredFields()

	if isLogsQuery(q) {
		return processEsqlLogsResponse(esqlRes, q, configuredFields)
	} else if isRawDocumentQuery(q) {
		return processEsqlRawDocumentResponse(esqlRes, q)
	} else if isRawDataQuery(q) {
		return processEsqlRawDataResponse(esqlRes, q)
	} else {
		// Metrics queries should return time series frames so they are compatible
		// with the same frontend flows as regular/raw DSL metrics queries.
		return processEsqlMetricsResponse(esqlRes, q)
	}
}

func (e *elasticsearchDataQuery) executeRegularQueries(queries []*Query, start time.Time) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	ms := e.client.MultiSearch()

	for _, q := range queries {
		from := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		if err := e.processQuery(q, ms, from, to); err != nil {
			mq, _ := json.Marshal(q)
			e.logger.Error("Failed to process query to multisearch request builder", "error", err, "query", string(mq), "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
			response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
			return response, nil
		}
	}

	req, err := ms.Build()
	if err != nil {
		mqs, _ := json.Marshal(queries)
		e.logger.Error("Failed to build multisearch request", "error", err, "queriesLength", len(queries), "queries", string(mqs), "duration", time.Since(start), "stage", es.StagePrepareRequest)
		response.Responses[queries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	e.logger.Info("Prepared request", "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
	res, err := e.client.ExecuteMultisearch(req)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			err = backend.DownstreamError(err)
		}
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			// Unsupported protocol scheme is a common error when the URL is not valid and should be treated as a downstream error
			if urlErr.Err != nil && strings.HasPrefix(urlErr.Err.Error(), "unsupported protocol scheme") {
				err = backend.DownstreamError(err)
			}
		}
		response.Responses[queries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	if res.Status >= 400 {
		statusErr := fmt.Errorf("unexpected status code: %d", res.Status)
		if backend.ErrorSourceFromHTTPStatus(res.Status) == backend.ErrorSourceDownstream {
			response.Responses[queries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(statusErr))
		} else {
			response.Responses[queries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.PluginError(statusErr))
		}
		return response, nil
	}

	return parseResponse(e.ctx, res.Responses, queries, e.client.GetConfiguredFields(), e.keepLabelsInResponse, e.logger)
}

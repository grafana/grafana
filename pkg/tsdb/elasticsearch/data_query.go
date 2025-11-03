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
	client               es.Client
	dataQueries          []backend.DataQuery
	logger               log.Logger
	ctx                  context.Context
	keepLabelsInResponse bool
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
		mqs, _ := json.Marshal(e.dataQueries)
		e.logger.Error("Failed to build multisearch request", "error", err, "queriesLength", len(queries), "queries", string(mqs), "duration", time.Since(start), "stage", es.StagePrepareRequest)
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
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
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	if res.Status >= 400 {
		statusErr := fmt.Errorf("unexpected status code: %d", res.Status)
		if backend.ErrorSourceFromHTTPStatus(res.Status) == backend.ErrorSourceDownstream {
			response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(statusErr))
		} else {
			response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.PluginError(statusErr))
		}
		return response, nil
	}

	return parseResponse(e.ctx, res.Responses, queries, e.client.GetConfiguredFields(), e.keepLabelsInResponse, e.logger)
}

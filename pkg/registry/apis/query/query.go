package query

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (b *QueryAPIBuilder) handleQuery(w http.ResponseWriter, r *http.Request) {
	reqDTO := v0alpha1.GenericQueryRequest{}
	if err := web.Bind(r, &reqDTO); err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}

	parsed, err := parseQueryRequest(reqDTO)
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}

	ctx := r.Context()
	qdr, err := b.processRequest(ctx, parsed)
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}

	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
			if b.returnMultiStatus {
				statusCode = http.StatusMultiStatus
			}
		}
	}
	if statusCode != http.StatusOK {
		requestmeta.WithDownstreamStatusSource(ctx)
	}

	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(qdr)
	if err != nil {
		errhttp.Write(r.Context(), err, w)
	}
}

// See:
// https://github.com/grafana/grafana/blob/v10.2.3/pkg/services/query/query.go#L88
func (b *QueryAPIBuilder) processRequest(ctx context.Context, req parsedQueryRequest) (qdr *backend.QueryDataResponse, err error) {
	switch len(req.Requests) {
	case 0:
		break // nothing to do
	case 1:
		qdr, err = b.handleQuerySingleDatasource(ctx, req.Requests[0])
	default:
		qdr, err = b.executeConcurrentQueries(ctx, req.Requests)
	}

	if len(req.Expressions) > 0 {
		return b.handleExpressions(ctx, qdr, req.Expressions)
	}
	return qdr, err
}

// Process a single request
// See: https://github.com/grafana/grafana/blob/v10.2.3/pkg/services/query/query.go#L242
func (b *QueryAPIBuilder) handleQuerySingleDatasource(ctx context.Context, req groupedQueries) (*backend.QueryDataResponse, error) {
	gv, err := b.registry.GetDatasourceGroupVersion(req.pluginId)
	if err != nil {
		return nil, err
	}
	return b.runner.ExecuteQueryData(ctx, gv, req.uid, req.query)
}

// buildErrorResponses applies the provided error to each query response in the list. These queries should all belong to the same datasource.
func buildErrorResponse(err error, req groupedQueries) *backend.QueryDataResponse {
	rsp := backend.NewQueryDataResponse()
	for _, query := range req.query {
		rsp.Responses[query.RefID] = backend.DataResponse{
			Error: err,
		}
	}
	return rsp
}

// executeConcurrentQueries executes queries to multiple datasources concurrently and returns the aggregate result.
func (b *QueryAPIBuilder) executeConcurrentQueries(ctx context.Context, requests []groupedQueries) (*backend.QueryDataResponse, error) {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(b.concurrentQueryLimit) // prevent too many concurrent requests
	rchan := make(chan *backend.QueryDataResponse, len(requests))

	// Create panic recovery function for loop below
	recoveryFn := func(req groupedQueries) {
		if r := recover(); r != nil {
			var err error
			b.log.Error("query datasource panic", "error", r, "stack", log.Stack(1))
			if theErr, ok := r.(error); ok {
				err = theErr
			} else if theErrString, ok := r.(string); ok {
				err = fmt.Errorf(theErrString)
			} else {
				err = fmt.Errorf("unexpected error - %s", b.userFacingDefaultError)
			}
			// Due to the panic, there is no valid response for any query for this datasource. Append an error for each one.
			rchan <- buildErrorResponse(err, req)
		}
	}

	// Query each datasource concurrently
	for idx := range requests {
		req := requests[idx]
		g.Go(func() error {
			defer recoveryFn(req)

			dqr, err := b.handleQuerySingleDatasource(ctx, req)
			if err == nil {
				rchan <- dqr
			} else {
				rchan <- buildErrorResponse(err, req)
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	close(rchan)

	// Merge the results from each response
	resp := backend.NewQueryDataResponse()
	for result := range rchan {
		for refId, dataResponse := range result.Responses {
			resp.Responses[refId] = dataResponse
		}
	}

	return resp, nil
}

// NOTE the upstream queries have already been executed
// https://github.com/grafana/grafana/blob/v10.2.3/pkg/services/query/query.go#L242
func (b *QueryAPIBuilder) handleExpressions(ctx context.Context, qdr *backend.QueryDataResponse, expressions []resource.GenericDataQuery) (*backend.QueryDataResponse, error) {
	return qdr, fmt.Errorf("expressions are not implemented yet")
}

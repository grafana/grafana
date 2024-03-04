package query

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type subQueryREST struct {
	builder *QueryAPIBuilder
}

var (
	_ rest.Storage              = (*subQueryREST)(nil)
	_ rest.SingularNameProvider = (*subQueryREST)(nil)
	_ rest.Creater              = (*subQueryREST)(nil)
	_ rest.StorageMetadata      = (*subQueryREST)(nil)
	_ rest.Scoper               = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	return &query.QueryDataRequest{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) NamespaceScoped() bool {
	return true
}

func (r *subQueryREST) GetSingularName() string {
	return "query"
}

// The query method (not really a create)
func (r *subQueryREST) Create(ctx context.Context, obj runtime.Object, validator rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	ctx, span := r.builder.tracer.Start(ctx, "QueryService.Query")
	defer span.End()

	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	// We use the orgId from ctx, so need to make sure it was the same one requested
	if info.OrgID < 1 {
		return nil, fmt.Errorf("invalid namespace")
	}

	raw, ok := obj.(*query.QueryDataRequest)
	if !ok {
		return nil, fmt.Errorf("error reading request")
	}

	// Parses and does basic validation
	req, err := r.builder.parser.parseRequest(ctx, raw)
	if err != nil {
		return nil, err
	}

	rsp, err := r.execute(ctx, req)
	if err != nil {
		return nil, err
	}

	// TODO? does this request make it though?
	statusCode := http.StatusOK
	for _, res := range rsp.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
			if r.builder.returnMultiStatus {
				statusCode = http.StatusMultiStatus
			}
		}
	}
	if statusCode != http.StatusOK {
		requestmeta.WithDownstreamStatusSource(ctx)
	}
	return &query.QueryDataResponse{
		QueryDataResponse: *rsp,
	}, err
}

func (r *subQueryREST) execute(ctx context.Context, req parsedRequestInfo) (qdr *backend.QueryDataResponse, err error) {
	switch len(req.Requests) {
	case 0:
		break // nothing to do
	case 1:
		qdr, err = r.builder.handleQuerySingleDatasource(ctx, req.Requests[0])
	default:
		qdr, err = r.builder.executeConcurrentQueries(ctx, req.Requests)
	}

	if len(req.Expressions) > 0 {
		qdr, err = r.builder.handleExpressions(ctx, req, qdr)
	}

	// Remove hidden results
	for _, refId := range req.HideBeforeReturn {
		r, ok := qdr.Responses[refId]
		if ok && r.Error == nil {
			delete(qdr.Responses, refId)
		}
	}
	return
}

// Process a single request
// See: https://github.com/grafana/grafana/blob/v10.2.3/pkg/services/query/query.go#L242
func (b *QueryAPIBuilder) handleQuerySingleDatasource(ctx context.Context, req datasourceRequest) (*backend.QueryDataResponse, error) {
	ctx, span := b.tracer.Start(ctx, "Query.handleQuerySingleDatasource")
	defer span.End()
	span.SetAttributes(
		attribute.String("datasource.type", req.PluginId),
		attribute.String("datasource.uid", req.UID),
	)

	allHidden := true
	for idx := range req.Request.Queries {
		if !req.Request.Queries[idx].Hide {
			allHidden = false
			break
		}
	}
	if allHidden {
		return &backend.QueryDataResponse{}, nil
	}

	gv, err := b.registry.GetDatasourceGroupVersion(req.PluginId)
	if err != nil {
		return nil, err
	}

	rsp, err := b.runner.ExecuteQueryData(ctx, gv, req.UID, req.Request.DataQueryRequest)
	if err == nil {
		for _, q := range req.Request.Queries {
			if q.ResultAssertions != nil {
				result, ok := rsp.Responses[q.RefID]
				if ok && result.Error == nil {
					err = q.ResultAssertions.Validate(result.Frames)
					if err != nil {
						result.Error = err
						result.ErrorSource = backend.ErrorSourceDownstream
						rsp.Responses[q.RefID] = result
					}
				}
			}
		}
	}
	return rsp, err
}

// buildErrorResponses applies the provided error to each query response in the list. These queries should all belong to the same datasource.
func buildErrorResponse(err error, req datasourceRequest) *backend.QueryDataResponse {
	rsp := backend.NewQueryDataResponse()
	for _, query := range req.Request.Queries {
		rsp.Responses[query.RefID] = backend.DataResponse{
			Error: err,
		}
	}
	return rsp
}

// executeConcurrentQueries executes queries to multiple datasources concurrently and returns the aggregate result.
func (b *QueryAPIBuilder) executeConcurrentQueries(ctx context.Context, requests []datasourceRequest) (*backend.QueryDataResponse, error) {
	ctx, span := b.tracer.Start(ctx, "Query.executeConcurrentQueries")
	defer span.End()

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(b.concurrentQueryLimit) // prevent too many concurrent requests
	rchan := make(chan *backend.QueryDataResponse, len(requests))

	// Create panic recovery function for loop below
	recoveryFn := func(req datasourceRequest) {
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

// Unlike the implementation in expr/node.go, all datasource queries have been processed first
func (b *QueryAPIBuilder) handleExpressions(ctx context.Context, req parsedRequestInfo, data *backend.QueryDataResponse) (qdr *backend.QueryDataResponse, err error) {
	start := time.Now()
	ctx, span := b.tracer.Start(ctx, "SSE.handleExpressions")
	defer func() {
		var respStatus string
		switch {
		case err == nil:
			respStatus = "success"
		default:
			respStatus = "failure"
		}
		duration := float64(time.Since(start).Nanoseconds()) / float64(time.Millisecond)
		b.metrics.expressionsQuerySummary.WithLabelValues(respStatus).Observe(duration)

		span.End()
	}()

	qdr = data
	if qdr == nil {
		qdr = &backend.QueryDataResponse{}
	}
	now := start // <<< this should come from the original query parser
	vars := make(mathexp.Vars)
	for _, expression := range req.Expressions {
		// Setup the variables
		for _, refId := range expression.Command.NeedsVars() {
			_, ok := vars[refId]
			if !ok {
				dr, ok := qdr.Responses[refId]
				if ok {
					allowLongFrames := false // TODO -- depends on input type and only if SQL?
					_, res, err := b.converter.Convert(ctx, req.RefIDTypes[refId], dr.Frames, allowLongFrames)
					if err != nil {
						res.Error = err
					}
					vars[expression.RefID] = res
				} else {
					// This should error in the parsing phase
					err := fmt.Errorf("missing variable %s", refId)
					qdr.Responses[expression.RefID] = backend.DataResponse{
						Error: err,
					}
					return qdr, err
				}
			}
		}

		refId := expression.RefID
		results, err := expression.Command.Execute(ctx, now, vars, b.tracer)
		if err != nil {
			qdr.Responses[refId] = backend.DataResponse{
				Error: err,
			}
		} else {
			vars[refId] = results
			qdr.Responses[refId] = backend.DataResponse{
				Error:  results.Error,
				Frames: results.Values.AsDataFrames(refId),
			}
		}
	}
	return qdr, nil
}

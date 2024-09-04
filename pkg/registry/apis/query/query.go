package query

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/errgroup"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

type queryREST struct {
	logger  log.Logger
	builder *QueryAPIBuilder
}

var (
	_ rest.Storage              = (*queryREST)(nil)
	_ rest.SingularNameProvider = (*queryREST)(nil)
	_ rest.Connecter            = (*queryREST)(nil)
	_ rest.Scoper               = (*queryREST)(nil)
	_ rest.StorageMetadata      = (*queryREST)(nil)
)

func newQueryREST(builder *QueryAPIBuilder) *queryREST {
	return &queryREST{
		logger:  log.New("query"),
		builder: builder,
	}
}

func (r *queryREST) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() says :)
	return &query.QueryDataResponse{}
}

func (r *queryREST) Destroy() {}

func (r *queryREST) NamespaceScoped() bool {
	return true
}

func (r *queryREST) GetSingularName() string {
	return "QueryResults" // Used for the
}

func (r *queryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *queryREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataResponse{}
}

func (r *queryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *queryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *queryREST) Connect(connectCtx context.Context, name string, _ runtime.Object, incomingResponder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}
	b := r.builder

	return http.HandlerFunc(func(w http.ResponseWriter, httpreq *http.Request) {
		ctx, span := b.tracer.Start(httpreq.Context(), "QueryService.Query")
		defer span.End()
		ctx = request.WithNamespace(ctx, request.NamespaceValue(connectCtx))

		responder := newResponderWrapper(incomingResponder,
			func(statusCode int, obj runtime.Object) {
				if statusCode >= 400 {
					span.SetStatus(codes.Error, fmt.Sprintf("error with HTTP status code %s", strconv.Itoa(statusCode)))
				}
			},
			func(err error) {
				span.SetStatus(codes.Error, "query error")
				if err == nil {
					return
				}

				span.RecordError(err)
			})

		raw := &query.QueryDataRequest{}
		err := web.Bind(httpreq, raw)
		if err != nil {
			err = errorsK8s.NewBadRequest("error reading query")
			// TODO: can we wrap the error so details are not lost?!
			// errutil.BadRequest(
			// 	"query.bind",
			// 	errutil.WithPublicMessage("Error reading query")).
			// 	Errorf("error reading: %w", err)
			responder.Error(err)
			return
		}
		// Parses the request and splits it into multiple sub queries (if necessary)
		req, err := b.parser.parseRequest(ctx, raw)
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				// TODO, can we wrap the error somehow?
				err = &errorsK8s.StatusError{ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest, // the URL is found, but includes bad requests
					Reason:  metav1.StatusReasonNotFound,
					Message: "datasource not found",
				}}
			}
			responder.Error(err)
			return
		}

		for i := range req.Requests {
			req.Requests[i].Headers = ExtractKnownHeaders(httpreq.Header)
		}

		// Actually run the query
		rsp, err := b.execute(ctx, req)
		if err != nil {
			responder.Error(err)
			return
		}

		responder.Object(query.GetResponseCode(rsp), &query.QueryDataResponse{
			QueryDataResponse: *rsp, // wrap the backend response as a QueryDataResponse
		})
	}), nil
}

func (b *QueryAPIBuilder) execute(ctx context.Context, req parsedRequestInfo) (qdr *backend.QueryDataResponse, err error) {
	switch len(req.Requests) {
	case 0:
		qdr = &backend.QueryDataResponse{}
	case 1:
		qdr, err = b.handleQuerySingleDatasource(ctx, req.Requests[0])
	default:
		qdr, err = b.executeConcurrentQueries(ctx, req.Requests)
	}

	if len(req.Expressions) > 0 {
		qdr, err = b.handleExpressions(ctx, req, qdr)
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

	client, err := b.client.GetDataSourceClient(
		ctx,
		v0alpha1.DataSourceRef{
			Type: req.PluginId,
			UID:  req.UID,
		},
		req.Headers,
	)
	if err != nil {
		return nil, err
	}

	code, rsp, err := client.QueryData(ctx, *req.Request)
	if err == nil && rsp != nil {
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

	// Create a response object with the error when missing (happens for client errors like 404)
	if rsp == nil && err != nil {
		rsp = &backend.QueryDataResponse{Responses: make(backend.Responses)}
		for _, q := range req.Request.Queries {
			rsp.Responses[q.RefID] = backend.DataResponse{
				Status: backend.Status(code),
				Error:  err,
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
				err = errors.New(theErrString)
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
	ctx, span := b.tracer.Start(ctx, "Query.handleExpressions")
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
	if qdr.Responses == nil {
		qdr.Responses = make(backend.Responses) // avoid NPE for lookup
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
					vars[refId] = res
				} else {
					// This should error in the parsing phase
					err := fmt.Errorf("missing variable %s for %s", refId, expression.RefID)
					qdr.Responses[refId] = backend.DataResponse{
						Error: err,
					}
					return qdr, err
				}
			}
		}

		refId := expression.RefID
		results, err := expression.Command.Execute(ctx, now, vars, b.tracer)
		if err != nil {
			results.Error = err
		}
		qdr.Responses[refId] = backend.DataResponse{
			Error:  results.Error,
			Frames: results.Values.AsDataFrames(refId),
		}
	}
	return qdr, nil
}

type responderWrapper struct {
	wrapped    rest.Responder
	onObjectFn func(statusCode int, obj runtime.Object)
	onErrorFn  func(err error)
}

func newResponderWrapper(responder rest.Responder, onObjectFn func(statusCode int, obj runtime.Object), onErrorFn func(err error)) *responderWrapper {
	return &responderWrapper{
		wrapped:    responder,
		onObjectFn: onObjectFn,
		onErrorFn:  onErrorFn,
	}
}

func (r responderWrapper) Object(statusCode int, obj runtime.Object) {
	if r.onObjectFn != nil {
		r.onObjectFn(statusCode, obj)
	}

	r.wrapped.Object(statusCode, obj)
}

func (r responderWrapper) Error(err error) {
	if r.onErrorFn != nil {
		r.onErrorFn(err)
	}

	r.wrapped.Error(err)
}

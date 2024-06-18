package query

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/errgroup"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
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

func (r *queryREST) Connect(ctx context.Context, name string, opts runtime.Object, incomingResponder rest.Responder) (http.Handler, error) {
	// See: /pkg/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}
	b := r.builder

	return http.HandlerFunc(func(w http.ResponseWriter, httpreq *http.Request) {
		ctx, span := b.tracer.Start(httpreq.Context(), "QueryService.Query")
		defer span.End()

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
		break // nothing to do
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

	// Add user headers... here or in client.QueryData
	pluginID := req.PluginId
	pluginUID := req.UID
	ctxLogger := b.log.New("datasource", pluginID, "dsUID", pluginUID).FromContext(ctx)
	runComparison := b.peformComparison(req, ctxLogger)
	var comparisonReq datasourceRequest
	if runComparison {
		comparisonReq = datasourceRequest{
			PluginId: pluginID,
			UID:      pluginUID,
			Request: &v0alpha1.QueryDataRequest{
				TimeRange: req.Request.TimeRange,
				Queries:   req.Request.Queries,
				Debug:     req.Request.Debug,
			},
			Headers: req.Headers, // TODO: fix this - this currently isn't used
		}
	}

	var err error
	ctx, err = b.client.PreprocessRequest(ctx)
	if err != nil {
		return nil, err
	}

	client, err := b.client.GetDataSourceClient(ctx, v0alpha1.DataSourceRef{
		Type: pluginID,
		UID:  pluginUID,
	})
	if err != nil {
		return nil, err
	}

	res := b.peformQuery(ctx, client, req, pluginID, pluginUID)
	// Create a response object with the error when missing (happens for client errors like 404)
	if res.response == nil && res.err != nil {
		res.response = &backend.QueryDataResponse{Responses: make(backend.Responses)}
		for _, q := range req.Request.Queries {
			res.response.Responses[q.RefID] = backend.DataResponse{
				Status: backend.Status(res.code),
				Error:  err,
			}
		}
	}

	if runComparison {
		b.log.Debug("running passive mode comparison to multi-tenant")
		go b.queryDataAndCompare(ctx, ctxLogger, pluginID, pluginUID, comparisonReq, res)
	}

	return res.response, res.err
}

type queryRes struct {
	code        int
	response    *backend.QueryDataResponse
	elapsedTime time.Duration
	err         error
}

func (b *QueryAPIBuilder) peformQuery(ctx context.Context, client v0alpha1.QueryDataClient, req datasourceRequest, pluginID, pluginUID string) queryRes {
	startTime := time.Now()
	code, rsp, err := client.QueryData(ctx, *req.Request)
	elapsedTime := time.Since(startTime)
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

	return queryRes{
		code:        code,
		response:    rsp,
		elapsedTime: elapsedTime,
		err:         err,
	}
}

// peformComparison determines if a comparison check should be made
func (b *QueryAPIBuilder) peformComparison(req datasourceRequest, ctxLogger log.Logger) bool {
	// not in passive mode
	if b.passiveModeClient == nil {
		return false
	}

	// Only compare Loki & Prometheus requests. We do not want to compare all requests
	// as some datasources have costs attached to queries.
	if req.PluginId != datasources.DS_PROMETHEUS && req.PluginId != datasources.DS_LOKI {
		return false
	}

	// do not compare relative requests - they will always be different since they
	// are served at different times
	_, err := strconv.ParseInt(req.Request.TimeRange.From, 10, 64)
	_, err2 := strconv.ParseInt(req.Request.TimeRange.To, 10, 64)
	if (err != nil) && (err2 != nil) {
		ctxLogger.Debug("relative query - not running comparison")
		return false
	}

	return true
}

// queryDataAndCompare runs the query again, this time from the MT service, and compares the results. All of this happens in a go routine and is non-blocking.
func (b *QueryAPIBuilder) queryDataAndCompare(ctx context.Context, ctxLogger log.Logger, pluginID string, pluginUID string, req datasourceRequest, originalRes queryRes) {
	client, err := (*b.passiveModeClient).GetDataSourceClient(ctx, v0alpha1.DataSourceRef{
		Type: pluginID,
		UID:  pluginUID,
	})
	if err != nil {
		ctxLogger.Error("unable to query", "error", err)
		return
	}

	// the original query will likely complete before this query. Do not use the same context so the query can complete.
	res := b.peformQuery(context.Background(), client, req, pluginID, pluginUID)
	if err != nil {
		b.increaseCompare(compareResultError, pluginID)
		ctxLogger.Error("unable to query", "error", err)
		return
	}

	if res.code != originalRes.code {
		b.increaseCompare(compareResultError, pluginID)
		ctxLogger.Error("codes do not match", "got", res.code, "expected", originalRes.code)
		return
	}

	if res.response.Responses != nil {
		b.compareResults(ctxLogger, pluginID, originalRes.response, res.response)
		// only compare duration if there is a response. Errors will usually be faster.
		b.reportDurationDiff(pluginID, originalRes.elapsedTime, res.elapsedTime)
	}
}

func (b *QueryAPIBuilder) compareResults(ctxLogger log.Logger, pluginID string, originalRes, newRes *backend.QueryDataResponse) bool {
	// If the length of both responses is different, we know that
	// something is not right and can straight up return.
	if len(originalRes.Responses) != len(newRes.Responses) {
		ctxLogger.Debug("response sizes are different", "expected", len(originalRes.Responses), "got", len(newRes.Responses))
		b.increaseCompare(compareResultDifferent, pluginID)
		return false
	}
	for k, v := range originalRes.Responses {
		vv, exists := newRes.Responses[k]
		if !exists {
			ctxLogger.Debug("key missing", "expected", k, "got", nil)
			b.increaseCompare(compareResultDifferent, pluginID)
			return false
		}
		if v.Status.String() != vv.Status.String() {
			ctxLogger.Debug("status different", "expected", v.Status, "got", vv.Status)
			b.increaseCompare(compareResultDifferent, pluginID)
			return false
		}
		if len(v.Frames) != len(vv.Frames) {
			ctxLogger.Debug("frame length different", "expected", len(v.Frames), "got", len(vv.Frames))
			b.increaseCompare(compareResultDifferent, pluginID)
			return false
		}
		for i, frame := range v.Frames {
			frame2 := vv.Frames[i]
			if frame.RefID != frame2.RefID {
				ctxLogger.Debug("refID different", "expected", frame.RefID, "got", frame2.RefID)
				b.increaseCompare(compareResultDifferent, pluginID)
				return false
			}
			if frame.Name != frame2.Name {
				ctxLogger.Debug("frame name different", "expected", frame.Name, "got", frame2.Name)
				b.increaseCompare(compareResultDifferent, pluginID)
				return false
			}
			if len(frame.Fields) != len(frame2.Fields) {
				ctxLogger.Debug("field length different", "expected", len(frame.Fields), "got", len(frame2.Fields))
				b.increaseCompare(compareResultDifferent, pluginID)
				return false
			}

			sort.Sort(byName(frame.Fields))
			sort.Sort(byName(frame2.Fields))
			for i, field := range frame.Fields {
				field2 := frame2.Fields[i]
				if field.Name != field2.Name {
					ctxLogger.Debug("field name different", "expected", field.Name, "got", field2.Name)
					b.increaseCompare(compareResultDifferent, pluginID)
					return false
				}
				if !field.Labels.Equals(field2.Labels) {
					ctxLogger.Debug("field labels different", "expected", field.Labels, "got", field2.Labels)
					b.increaseCompare(compareResultDifferent, pluginID)
					return false
				}
				if field.Type().String() != field2.Type().String() {
					ctxLogger.Debug("field type different", "expected", field.Type().String(), "got", field2.Type().String())
					b.increaseCompare(compareResultDifferent, pluginID)
					return false
				}
				if field.Len() != field2.Len() {
					ctxLogger.Debug("field length different", "expected", field.Len(), "got", field2.Len())
					b.increaseCompare(compareResultDifferent, pluginID)
					return false
				}
				// This will give a first good impression - comparing the content of the field / real values
				// might be tricky as we don't know the type and how to compare them.
			}
		}
	}
	b.increaseCompare(compareResultEqual, pluginID)
	return true
}

type byName []*data.Field

func (a byName) Len() int           { return len(a) }
func (a byName) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byName) Less(i, j int) bool { return a[i].Name < a[j].Name }

func (b *QueryAPIBuilder) increaseCompare(result, dsType string) {
	b.metrics.dsCompare.With(prometheus.Labels{
		compareLabelResult:         result,
		compareLabelDatasourceType: dsType,
	}).Add(1)
}

func (b *QueryAPIBuilder) reportDurationDiff(dsType string, stDuration, mtDuration time.Duration) {
	durationDifference := mtDuration - stDuration
	b.metrics.queryDurationDiff.With(prometheus.Labels{compareLabelDatasourceType: dsType}).Observe(durationDifference.Seconds())
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

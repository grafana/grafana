package query

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/mtdsclient"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	ds_service "github.com/grafana/grafana/pkg/services/datasources/service"
	service "github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/web"
)

type queryREST struct {
	logger  log.Logger
	builder *QueryAPIBuilder
}

type MyCacheService struct {
	legacy ds_service.LegacyDataSourceLookup
}

func (mcs *MyCacheService) GetDatasource(ctx context.Context, datasourceID int64, _ identity.Requester, _ bool) (*datasources.DataSource, error) {
	ref, err := mcs.legacy.GetDataSourceFromDeprecatedFields(ctx, "", datasourceID)
	if err != nil {
		return nil, err
	}
	return &datasources.DataSource{
		UID:  ref.UID,
		Type: ref.Type,
	}, nil
}

func (mcs *MyCacheService) GetDatasourceByUID(ctx context.Context, datasourceUID string, _ identity.Requester, _ bool) (*datasources.DataSource, error) {
	ref, err := mcs.legacy.GetDataSourceFromDeprecatedFields(ctx, datasourceUID, 0)
	if err != nil {
		return nil, err
	}
	return &datasources.DataSource{
		UID:  ref.UID,
		Type: ref.Type,
	}, nil
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

// called by mt query service and also when queryServiceFromUI is enabled, can be both mt and st
func (r *queryREST) Connect(connectCtx context.Context, name string, _ runtime.Object, incomingResponder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		r.logger.Debug("Connect name is not name")
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}
	b := r.builder

	return http.HandlerFunc(func(w http.ResponseWriter, httpreq *http.Request) {
		ctx, span := b.tracer.Start(httpreq.Context(), "QueryService.Query")
		defer span.End()
		ctx = request.WithNamespace(ctx, request.NamespaceValue(connectCtx))
		traceId := span.SpanContext().TraceID()
		connectLogger := b.log.New("traceId", traceId.String())
		responder := newResponderWrapper(incomingResponder,
			func(statusCode *int, obj runtime.Object) {
				if *statusCode/100 == 4 {
					span.SetStatus(codes.Error, strconv.Itoa(*statusCode))
				}

				if *statusCode >= 500 {
					o, ok := obj.(*query.QueryDataResponse)
					if ok && o.Responses != nil {
						for refId, response := range o.Responses {
							if response.ErrorSource == backend.ErrorSourceDownstream {
								*statusCode = http.StatusBadRequest //force this to be a 400 since it's downstream
								span.SetStatus(codes.Error, strconv.Itoa(*statusCode))
								span.SetAttributes(attribute.String("error.source", "downstream"))
								break
							} else if response.Error != nil {
								connectLogger.Debug("500 error without downstream error source", "error", response.Error, "errorSource", response.ErrorSource, "refId", refId)
								span.SetStatus(codes.Error, "500 error without downstream error source")
							} else {
								span.SetStatus(codes.Error, "500 error without downstream error source and no Error message")
								span.SetAttributes(attribute.String("error.ref_id", refId))
							}
						}
					}
				}
			},

			func(err error) {
				connectLogger.Error("error caught in handler", "err", err)
				span.SetStatus(codes.Error, "query error")

				if err == nil {
					return
				}

				span.RecordError(err)
			})

		raw := &query.QueryDataRequest{}
		err := web.Bind(httpreq, raw)
		if err != nil {
			b.log.Error("Hit unexpected error when reading query", "err", err)
			err = errorsK8s.NewBadRequest("error reading query")
			// TODO: can we wrap the error so details are not lost?!
			// errutil.BadRequest(
			// 	"query.bind",
			// 	errutil.WithPublicMessage("Error reading query")).
			// 	Errorf("error reading: %w", err)
			responder.Error(err)
			return
		}

		qdr, err := handleQuery(ctx, *raw, *b, httpreq, *responder, connectLogger)

		if err != nil {
			b.log.Error("execute error", "http code", query.GetResponseCode(qdr), "err", err)
			logEmptyRefids(raw.Queries, b.log)
			if qdr != nil { // if we have a response, we assume the err is set in the response
				responder.Object(query.GetResponseCode(qdr), &query.QueryDataResponse{
					QueryDataResponse: *qdr,
				})
				return
			} else {
				var errorDataResponse backend.DataResponse
				if errors.Is(err, service.ErrInvalidDatasourceID) || errors.Is(err, service.ErrNoQueriesFound) || errors.Is(err, service.ErrMissingDataSourceInfo) || errors.Is(err, service.ErrQueryParamMismatch) || errors.Is(err, service.ErrDuplicateRefId) {
					errorDataResponse = backend.ErrDataResponseWithSource(backend.StatusBadRequest, backend.ErrorSourceDownstream, err.Error())
				} else if strings.Contains(err.Error(), "expression request error") {
					b.log.Error("Error calling TransformData in an expression", "err", err)
					errorDataResponse = backend.ErrDataResponseWithSource(backend.StatusBadRequest, backend.ErrorSourceDownstream, err.Error())
				} else {
					b.log.Error("unknown error, treated as a 500", "err", err)
					responder.Error(err)
					return
				}
				qdr = &backend.QueryDataResponse{
					Responses: map[string]backend.DataResponse{
						"A": errorDataResponse,
					},
				}
				responder.Object(query.GetResponseCode(qdr), &query.QueryDataResponse{
					QueryDataResponse: *qdr,
				})
				return
			}
		}

		responder.Object(query.GetResponseCode(qdr), &query.QueryDataResponse{
			QueryDataResponse: *qdr, // wrap the backend response as a QueryDataResponse
		})
	}), nil
}

func handleQuery(ctx context.Context, raw query.QueryDataRequest, b QueryAPIBuilder, httpreq *http.Request, responder responderWrapper, connectLogger log.Logger) (*backend.QueryDataResponse, error) {
	var jsonQueries = make([]*simplejson.Json, 0, len(raw.Queries))
	for _, query := range raw.Queries {
		jsonBytes, err := json.Marshal(query)
		if err != nil {
			b.log.Error("error marshalling", err)
		}

		sjQuery, _ := simplejson.NewJson(jsonBytes)
		if err != nil {
			b.log.Error("error unmarshalling", err)
		}

		jsonQueries = append(jsonQueries, sjQuery)
	}

	mReq := dtos.MetricRequest{
		From:    raw.From,
		To:      raw.To,
		Queries: jsonQueries,
	}

	cache := &MyCacheService{
		legacy: b.legacyDatasourceLookup,
	}

	headers := ExtractKnownHeaders(httpreq.Header)

	instanceConfig, err := b.clientSupplier.GetInstanceConfigurationSettings(ctx)
	if err != nil {
		connectLogger.Error("failed to get instance configuration settings", "err", err)
		responder.Error(err)
		return nil, err
	}

	dsQuerierLoggerWithSlug := connectLogger.New("slug", instanceConfig.Options["slug"], "ruleuid", headers["X-Rule-Uid"])

	mtDsClientBuilder := mtdsclient.NewMtDatasourceClientBuilderWithClientSupplier(
		b.clientSupplier,
		ctx,
		headers,
		instanceConfig,
		dsQuerierLoggerWithSlug,
	)

	exprService := expr.ProvideService(
		&setting.Cfg{
			ExpressionsEnabled:           instanceConfig.ExpressionsEnabled,
			SQLExpressionCellLimit:       instanceConfig.SQLExpressionCellLimit,
			SQLExpressionOutputCellLimit: instanceConfig.SQLExpressionOutputCellLimit,
			SQLExpressionTimeout:         instanceConfig.SQLExpressionTimeout,
		},
		nil,
		nil,
		instanceConfig.FeatureToggles,
		nil,
		b.tracer,
		mtDsClientBuilder,
	)

	qdr, err := service.QueryData(ctx, dsQuerierLoggerWithSlug, cache, exprService, mReq, mtDsClientBuilder, headers)

	if err != nil {
		return qdr, err
	}

	return qdr, nil
}

type responderWrapper struct {
	wrapped    rest.Responder
	onObjectFn func(statusCode *int, obj runtime.Object)
	onErrorFn  func(err error)
}

func newResponderWrapper(responder rest.Responder, onObjectFn func(statusCode *int, obj runtime.Object), onErrorFn func(err error)) *responderWrapper {
	return &responderWrapper{
		wrapped:    responder,
		onObjectFn: onObjectFn,
		onErrorFn:  onErrorFn,
	}
}

func (r responderWrapper) Object(statusCode int, obj runtime.Object) {
	if r.onObjectFn != nil {
		r.onObjectFn(&statusCode, obj)
	}

	r.wrapped.Object(statusCode, obj)
}

func (r responderWrapper) Error(err error) {
	if r.onErrorFn != nil {
		r.onErrorFn(err)
	}

	r.wrapped.Error(err)
}

func logEmptyRefids(queries []v0alpha1.DataQuery, logger log.Logger) {
	emptyCount := 0

	for _, q := range queries {
		if q.RefID == "" {
			emptyCount += 1
		}
	}

	if emptyCount > 0 {
		logger.Info("empty refid found", "empty_count", emptyCount, "query_count", len(queries))
	}
}

func mergeHeaders(main http.Header, extra http.Header, l log.Logger) {
	for headerName, extraValues := range extra {
		mainValues := main.Values(headerName)
		for _, extraV := range extraValues {
			if !slices.Contains(mainValues, extraV) {
				main.Add(headerName, extraV)
			} else {
				l.Warn("skipped duplicate response header", "header", headerName, "value", extraV)
			}
		}
	}
}

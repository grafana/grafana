package query

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	service "github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/web"
)

type sqlSchemaREST struct {
	logger  log.Logger
	builder *QueryAPIBuilder
}

var (
	_ rest.Storage              = (*sqlSchemaREST)(nil)
	_ rest.SingularNameProvider = (*sqlSchemaREST)(nil)
	_ rest.Connecter            = (*sqlSchemaREST)(nil)
	_ rest.Scoper               = (*sqlSchemaREST)(nil)
	_ rest.StorageMetadata      = (*sqlSchemaREST)(nil)
)

func newSQLSchemaREST(builder *QueryAPIBuilder) *sqlSchemaREST {
	return &sqlSchemaREST{
		logger:  log.New("query.sqlschema"),
		builder: builder,
	}
}

func (r *sqlSchemaREST) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() says :)
	return &query.SQLSchemaResponse{}
}

func (r *sqlSchemaREST) Destroy() {}

func (r *sqlSchemaREST) NamespaceScoped() bool {
	return true
}

func (r *sqlSchemaREST) GetSingularName() string {
	return "SQLSchema" // Used for the
}

func (r *sqlSchemaREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *sqlSchemaREST) ProducesObject(verb string) interface{} {
	return &query.SQLSchemaResponse{}
}

func (r *sqlSchemaREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *sqlSchemaREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

// called by mt query service and also when queryServiceFromUI is enabled, can be both mt and st
func (r *sqlSchemaREST) Connect(connectCtx context.Context, name string, _ runtime.Object, incomingResponder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		r.logger.Debug("Connect name is not name")
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}
	b := r.builder

	return http.HandlerFunc(func(w http.ResponseWriter, httpreq *http.Request) {
		ctx, span := b.tracer.Start(httpreq.Context(), "QueryService.GetSQLSchema")
		defer span.End()
		ctx = request.WithNamespace(ctx, request.NamespaceValue(connectCtx))
		traceId := span.SpanContext().TraceID()
		connectLogger := b.log.New("traceId", traceId.String(), "rule_uid", httpreq.Header.Get("X-Rule-Uid"))
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
			connectLogger.Error("Hit unexpected error when reading query", "err", err)
			err = errorsK8s.NewBadRequest("error reading query")
			// TODO: can we wrap the error so details are not lost?!
			// errutil.BadRequest(
			// 	"query.bind",
			// 	errutil.WithPublicMessage("Error reading query")).
			// 	Errorf("error reading: %w", err)
			responder.Error(err)
			return
		}

		qdr, err := handleSQLSchemaQuery(ctx, *raw, *b, httpreq, *responder, connectLogger)

		if err != nil {
			connectLogger.Error("execute error", "http code", query.GetResponseCode(qdr), "err", err)
			logEmptyRefids(raw.Queries, connectLogger)
			if qdr != nil { // if we have a response, we assume the err is set in the response
				responder.Object(query.GetResponseCode(qdr), &query.QueryDataResponse{
					QueryDataResponse: *qdr,
				})
				return
			} else {
				var errorDataResponse backend.DataResponse

				badRequestErrors := []error{
					service.ErrInvalidDatasourceID,
					service.ErrNoQueriesFound,
					service.ErrMissingDataSourceInfo,
					service.ErrQueryParamMismatch,
					service.ErrDuplicateRefId,
					datasources.ErrDataSourceNotFound,
				}
				isTypedBadRequestError := false
				for _, badRequestError := range badRequestErrors {
					if errors.Is(err, badRequestError) {
						isTypedBadRequestError = true
					}
				}
				if isTypedBadRequestError {
					errorDataResponse = backend.ErrDataResponseWithSource(backend.StatusBadRequest, backend.ErrorSourceDownstream, err.Error())
				} else if strings.Contains(err.Error(), "expression request error") {
					connectLogger.Error("Error calling TransformData in an expression", "err", err)
					errorDataResponse = backend.ErrDataResponseWithSource(backend.StatusBadRequest, backend.ErrorSourceDownstream, err.Error())
				} else {
					connectLogger.Error("unknown error, treated as a 500", "err", err)
					responder.Error(err)
					return
				}
				// TODO ensure errors also return the refId wherever possible
				errorRefId := raw.Queries[0].RefID
				if errorRefId == "" {
					errorRefId = "A"
				}

				qdr = &backend.QueryDataResponse{
					Responses: map[string]backend.DataResponse{
						errorRefId: errorDataResponse,
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

func handleSQLSchemaQuery(ctx context.Context, raw query.QueryDataRequest, b QueryAPIBuilder, httpreq *http.Request, responder responderWrapper, connectLogger log.Logger) (*backend.QueryDataResponse, error) {
	spew.Dump("SQLSchemaRequest", raw)
	var jsonQueries = make([]*simplejson.Json, 0, len(raw.Queries))
	for _, query := range raw.Queries {
		jsonBytes, err := json.Marshal(query)
		if err != nil {
			connectLogger.Error("error marshalling", err)
		}

		sjQuery, _ := simplejson.NewJson(jsonBytes)
		if err != nil {
			connectLogger.Error("error unmarshalling", err)
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

	instance, err := b.instanceProvider.GetInstance(ctx, headers)
	if err != nil {
		connectLogger.Error("failed to get instance configuration settings", "err", err)
		responder.Error(err)
		return nil, err
	}

	instanceConfig := instance.GetSettings()

	dsQuerierLoggerWithSlug := instance.GetLogger(connectLogger)

	qsDsClientBuilder := dsquerierclient.NewQsDatasourceClientBuilderWithInstance(
		instance,
		ctx,
		dsQuerierLoggerWithSlug,
	)

	exprService := expr.ProvideService(
		&setting.Cfg{
			ExpressionsEnabled:            instanceConfig.ExpressionsEnabled,
			SQLExpressionCellLimit:        instanceConfig.SQLExpressionCellLimit,
			SQLExpressionOutputCellLimit:  instanceConfig.SQLExpressionOutputCellLimit,
			SQLExpressionTimeout:          instanceConfig.SQLExpressionTimeout,
			SQLExpressionQueryLengthLimit: instanceConfig.SQLExpressionQueryLengthLimit,
		},
		nil,
		nil,
		instanceConfig.FeatureToggles,
		nil,
		b.tracer,
		qsDsClientBuilder,
	)

	qdr, err := service.QueryData(ctx, dsQuerierLoggerWithSlug, cache, exprService, mReq, qsDsClientBuilder, headers)

	// tell the `instance` structure that it can now report
	// metrics that are only reported once during a request
	instance.ReportMetrics()

	if err != nil {
		return qdr, err
	}

	return qdr, nil
}

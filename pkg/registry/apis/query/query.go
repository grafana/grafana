package query

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/setting"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	ds_service "github.com/grafana/grafana/pkg/services/datasources/service"
	service "github.com/grafana/grafana/pkg/services/query"
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

	return http.HandlerFunc(func(w http.ResponseWriter, httpreq *http.Request) {
		w.Header().Set("Location", "/api/ds/query")
		w.WriteHeader(http.StatusTemporaryRedirect)
		fmt.Fprintln(w, "go away")
	}), nil
}

func handleQuery(ctx context.Context, raw query.QueryDataRequest, b QueryAPIBuilder, httpreq *http.Request, responder responderWrapper, connectLogger log.Logger) (*backend.QueryDataResponse, error) {
	var jsonQueries = make([]*simplejson.Json, 0, len(raw.Queries))
	for _, query := range raw.Queries {
		dsRef, err := getValidDataSourceRef(ctx, query.Datasource, query.DatasourceID, b.legacyDatasourceLookup)
		if err != nil {
			connectLogger.Error("error getting valid datasource ref", err)
		}
		if dsRef != nil {
			query.Datasource = dsRef
		}

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

	instance, err := b.instanceProvider.GetInstance(ctx, connectLogger, headers)
	if err != nil {
		connectLogger.Error("failed to get instance configuration settings", "err", err)
		responder.Error(err)
		return nil, err
	}

	instanceConfig := instance.GetSettings()

	dsQuerierLoggerWithSlug := instance.GetLogger()

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

/*
most queries are stored like this:

	{
		datasource: {
			uid: "123",
			type: "cool-ds",
		}
	}

but sometimes queries are stored like:

	{
		datasourceUid: "123",
		datasource: {
			type: "cool-ds",
		}
	}

this sets the second case to match the first and looks up missing types
*/
func getValidDataSourceRef(ctx context.Context, ds *v0alpha1.DataSourceRef, id int64, legacyDatasourceLookup ds_service.LegacyDataSourceLookup) (*v0alpha1.DataSourceRef, error) {
	if ds == nil {
		if id == 0 {
			return nil, fmt.Errorf("missing datasource reference or id")
		}
		if legacyDatasourceLookup == nil {
			return nil, fmt.Errorf("legacy datasource lookup unsupported (id:%d)", id)
		}
		return legacyDatasourceLookup.GetDataSourceFromDeprecatedFields(ctx, "", id)
	}

	// we need to special-case the "grafana" data source
	if ds.UID == "grafana" {
		return &v0alpha1.DataSourceRef{
			// it does not really matter what `type` we set here,
			// we will always detect this case by `uid` later.
			// here we go with what the data source's plugin.json says.
			Type: "grafana",
			UID:  "grafana",
		}, nil
	}

	if ds.Type == "" {
		if ds.UID == "" {
			return nil, fmt.Errorf("missing name/uid in data source reference")
		}
		if expr.IsDataSource(ds.UID) {
			return ds, nil
		}
		if legacyDatasourceLookup == nil {
			return nil, fmt.Errorf("legacy datasource lookup unsupported (name:%s)", ds.UID)
		}
		return legacyDatasourceLookup.GetDataSourceFromDeprecatedFields(ctx, ds.UID, 0)
	}

	if ds.UID == "" && expr.IsDataSource(ds.Type) {
		ds.UID = ds.Type
		return ds, nil
	}

	return ds, nil
}

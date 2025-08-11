package query

import (
	"context"
	"encoding/json"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	claims "github.com/grafana/authlib/types"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/client"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*QueryAPIBuilder)(nil)

type QueryAPIBuilder struct {
	log                  log.Logger
	concurrentQueryLimit int
	features             featuremgmt.FeatureToggles

	authorizer authorizer.Authorizer

	tracer                 tracing.Tracer
	metrics                *metrics.ExprMetrics
	instanceProvider       clientapi.InstanceProvider
	registry               query.DataSourceApiServerRegistry
	converter              *expr.ResultConverter
	queryTypes             *query.QueryTypeDefinitionList
	legacyDatasourceLookup service.LegacyDataSourceLookup
}

func NewQueryAPIBuilder(
	features featuremgmt.FeatureToggles,
	instanceProvider clientapi.InstanceProvider,
	ar authorizer.Authorizer,
	registry query.DataSourceApiServerRegistry,
	registerer prometheus.Registerer,
	tracer tracing.Tracer,
	legacyDatasourceLookup service.LegacyDataSourceLookup,
) (*QueryAPIBuilder, error) {
	// Include well typed query definitions
	var queryTypes *query.QueryTypeDefinitionList
	if features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryTypes) {
		// Read the expression query definitions
		raw, err := expr.QueryTypeDefinitionListJSON()
		if err != nil {
			return nil, err
		}
		queryTypes = &query.QueryTypeDefinitionList{}
		err = json.Unmarshal(raw, queryTypes)
		if err != nil {
			return nil, err
		}
	}

	return &QueryAPIBuilder{
		concurrentQueryLimit: 4,
		log:                  log.New("query_apiserver"),
		instanceProvider:     instanceProvider,
		authorizer:           ar,
		registry:             registry,
		metrics:              metrics.NewQueryServiceExpressionsMetrics(registerer),
		tracer:               tracer,
		features:             features,
		queryTypes:           queryTypes,
		converter: &expr.ResultConverter{
			Features: features,
			Tracer:   tracer,
		},
		legacyDatasourceLookup: legacyDatasourceLookup,
	}, nil
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dataSourcesService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
	pluginClient plugins.Client,
	pCtxProvider *plugincontext.Provider,
	registerer prometheus.Registerer,
	tracer tracing.Tracer,
	legacyDatasourceLookup service.LegacyDataSourceLookup,
	exprService *expr.Service,
) (*QueryAPIBuilder, error) {
	if !featuremgmt.AnyEnabled(features,
		featuremgmt.FlagQueryService,
		featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless explicitly added (or all experimental are added)
	}

	ar := authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			// we only verify that we have a valid user.
			// the "real" check will happen when the specific
			// data sources are loaded.
			_, ok := claims.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "valid user is required", nil
			}

			return authorizer.DecisionAllow, "", nil
		})

	builder, err := NewQueryAPIBuilder(
		features,
		client.NewSingleTenantInstanceProvider(cfg, features, pluginClient, pCtxProvider, accessControl),
		ar,
		client.NewDataSourceRegistryFromStore(pluginStore, dataSourcesService),
		registerer,
		tracer,
		legacyDatasourceLookup,
	)
	apiregistration.RegisterAPI(builder)
	return builder, err
}

func (b *QueryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return query.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&query.DataSourceApiServer{},
		&query.DataSourceApiServerList{},
		&query.QueryDataRequest{},
		&query.QueryDataResponse{},
		&query.QueryTypeDefinition{},
		&query.QueryTypeDefinitionList{},
	)
}

func (b *QueryAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, query.SchemeGroupVersion)
	metav1.AddToGroupVersion(scheme, query.SchemeGroupVersion)
	return scheme.SetVersionPriority(query.SchemeGroupVersion)
}

func (b *QueryAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *QueryAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	gv := query.SchemeGroupVersion

	storage := map[string]rest.Storage{}

	plugins := newPluginsStorage(b.registry)
	storage[plugins.resourceInfo.StoragePath()] = plugins
	if !b.features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		// The plugin registry is still experimental, and not yet accurate
		// For standard k8s api discovery to work, at least one resource must be registered
		// While this feature is under development, we can return an empty list for non-dev instances
		plugins.returnEmptyList = true
	}

	// The query endpoint -- NOTE, this uses a rewrite hack to allow requests without a name parameter
	storage["query"] = newQueryREST(b)

	// Register the expressions query schemas
	err := queryschema.RegisterQueryTypes(b.queryTypes, storage)

	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return err
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return query.GetOpenAPIDefinitions
}

func (b *QueryAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *QueryAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Query service"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Add queries to the request properties
	err := queryschema.AddQueriesToOpenAPI(queryschema.OASQueryOptions{
		Swagger: oas,
		PluginJSON: &plugins.JSONData{
			ID: expr.DatasourceType, // Not really a plugin, but identified the same way
		},
		QueryTypes:       b.queryTypes,
		Root:             root,
		QueryPath:        "namespaces/{namespace}/query/{name}",
		QueryDescription: "Query any datasources (with expressions)",

		// An explicit set of examples (otherwise we iterate the query type examples)
		QueryExamples: map[string]*spec3.Example{
			"A": {
				ExampleProps: spec3.ExampleProps{
					Summary:     "Random walk (testdata)",
					Description: "Use testdata to execute a random walk query",
					Value: `{
						"queries": [
							{
								"refId": "A",
								"scenarioId": "random_walk_table",
								"seriesCount": 1,
								"datasource": {
								"type": "grafana-testdata-datasource",
								"uid": "PD8C576611E62080A"
								},
								"intervalMs": 60000,
								"maxDataPoints": 20
							}
						],
						"from": "now-6h",
						"to": "now"
					}`,
				},
			},
			"B": {
				ExampleProps: spec3.ExampleProps{
					Summary:     "With deprecated datasource name",
					Description: "Includes an old style string for datasource reference",
					Value: `{
						"queries": [
							{
								"refId": "A",
								"datasource": {
									"type": "grafana-googlesheets-datasource",
									"uid": "b1808c48-9fc9-4045-82d7-081781f8a553"
								},
								"cacheDurationSeconds": 300,
								"spreadsheet": "spreadsheetID",
								"datasourceId": 4,
								"intervalMs": 30000,
								"maxDataPoints": 794
							},
							{
								"refId": "Z",
								"datasource": "old",
								"maxDataPoints": 10,
								"timeRange": {
									"from": "100",
									"to": "200"
								}
							}
						],
						"from": "now-6h",
						"to": "now"
					}`,
				},
			},
		},
	})
	if err != nil {
		return oas, nil
	}

	return oas, nil
}

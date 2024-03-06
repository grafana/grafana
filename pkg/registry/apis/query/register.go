package query

import (
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/client"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var _ builder.APIGroupBuilder = (*QueryAPIBuilder)(nil)

type QueryAPIBuilder struct {
	log                    log.Logger
	concurrentQueryLimit   int
	userFacingDefaultError string
	returnMultiStatus      bool // from feature toggle
	features               featuremgmt.FeatureToggles

	tracer    tracing.Tracer
	metrics   *metrics
	parser    *queryParser
	client    DataSourceClientSupplier
	registry  v0alpha1.DataSourceApiServerRegistry
	converter *expr.ResultConverter
}

func NewQueryAPIBuilder(features featuremgmt.FeatureToggles,
	client DataSourceClientSupplier,
	registry v0alpha1.DataSourceApiServerRegistry,
	legacy service.LegacyDataSourceLookup,
	registerer prometheus.Registerer,
	tracer tracing.Tracer,
) (*QueryAPIBuilder, error) {
	reader := expr.NewExpressionQueryReader(features)
	return &QueryAPIBuilder{
		concurrentQueryLimit: 4,
		log:                  log.New("query_apiserver"),
		returnMultiStatus:    features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryMultiStatus),
		client:               client,
		registry:             registry,
		parser:               newQueryParser(reader, legacy, tracer),
		metrics:              newMetrics(registerer),
		tracer:               tracer,
		features:             features,
		converter: &expr.ResultConverter{
			Features: features,
			Tracer:   tracer,
		},
	}, nil
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dataSourcesService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
	pluginClient plugins.Client,
	pCtxProvider *plugincontext.Provider,
	registerer prometheus.Registerer,
	tracer tracing.Tracer,
	legacy service.LegacyDataSourceLookup,
) (*QueryAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	builder, err := NewQueryAPIBuilder(
		features,
		&CommonDataSourceClientSupplier{
			Client: client.NewQueryClientForPluginClient(pluginClient, pCtxProvider),
		},
		client.NewDataSourceRegistryFromStore(pluginStore, dataSourcesService),
		legacy, registerer, tracer,
	)
	apiregistration.RegisterAPI(builder)
	return builder, err
}

func (b *QueryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.DataSourceApiServer{},
		&v0alpha1.DataSourceApiServerList{},
		&v0alpha1.QueryDataRequest{},
		&v0alpha1.QueryDataResponse{},
		&v0alpha1.QueryTypeDefinition{},
		&v0alpha1.QueryTypeDefinitionList{},
		&example.DummySubresource{},
	)
}

func (b *QueryAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, v0alpha1.SchemeGroupVersion)
	metav1.AddToGroupVersion(scheme, v0alpha1.SchemeGroupVersion)
	return scheme.SetVersionPriority(v0alpha1.SchemeGroupVersion)
}

func (b *QueryAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	_ bool,
) (*genericapiserver.APIGroupInfo, error) {
	gv := v0alpha1.SchemeGroupVersion
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(gv.Group, scheme, metav1.ParameterCodec, codecs)

	plugins := newPluginsStorage(b.registry)

	storage := map[string]rest.Storage{}
	storage[plugins.resourceInfo.StoragePath()] = plugins
	storage["query"] = &subQueryREST{builder: b}

	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *QueryAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (b *QueryAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default is OK
}

func (b *QueryAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Query service"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Adding in sample queries
	sub := oas.Paths.Paths[root+"namespaces/{namespace}/query"]
	if sub != nil && sub.Post != nil {
		params := []*spec3.Parameter{}
		for _, p := range sub.Parameters {
			if p.Name == "namespace" { // maybe pretty & dryRun?
				p.Schema.Default = "default"
				params = append(params, p)
			}
		}
		sub.Parameters = params
		content := sub.Post.RequestBody.Content
		content["application/json"] = &spec3.MediaType{
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: content["*/*"].Schema,
				Examples: map[string]*spec3.Example{
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
			},
		}
		delete(content, "*/*") // does not accept anything
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

package query

import (
	"encoding/json"
	"net/http"

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
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/runner"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
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

	runner   v0alpha1.QueryRunner
	registry v0alpha1.DataSourceApiServerRegistry
}

func NewQueryAPIBuilder(features featuremgmt.FeatureToggles,
	runner v0alpha1.QueryRunner,
	registry v0alpha1.DataSourceApiServerRegistry,
) *QueryAPIBuilder {
	return &QueryAPIBuilder{
		concurrentQueryLimit: 4, // from config?
		log:                  log.New("query_apiserver"),
		returnMultiStatus:    features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryMultiStatus),
		runner:               runner,
		registry:             registry,
	}
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dataSourcesService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
	pluginClient plugins.Client,
	pCtxProvider *plugincontext.Provider,
) *QueryAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := NewQueryAPIBuilder(
		features,
		runner.NewDirectQueryRunner(pluginClient, pCtxProvider),
		runner.NewDirectRegistry(pluginStore, dataSourcesService),
	)

	// ONLY testdata...
	if false {
		builder = NewQueryAPIBuilder(
			features,
			runner.NewDummyTestRunner(),
			runner.NewDummyRegistry(),
		)
	}

	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *QueryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.DataSourceApiServer{},
		&v0alpha1.DataSourceApiServerList{},
		&v0alpha1.QueryDataResponse{},
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

	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *QueryAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := v0alpha1.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	querySchema := defs["github.com/grafana/grafana/pkg/apis/query/v0alpha1.QueryRequest"].Schema
	responseSchema := defs["github.com/grafana/grafana/pkg/apis/query/v0alpha1.QueryDataResponse"].Schema

	var randomWalkQuery any
	var randomWalkTable any
	_ = json.Unmarshal([]byte(`{
		"queries": [
		  {
			"refId": "A",
			"scenarioId": "random_walk",
			"seriesCount": 1,
			"datasource": {
			  "type": "grafana-testdata-datasource",
			  "uid": "PD8C576611E62080A"
			},
			"intervalMs": 60000,
			"maxDataPoints": 20
		  }
		],
		"from": "1704893381544",
		"to": "1704914981544"
	  }`), &randomWalkQuery)

	_ = json.Unmarshal([]byte(`{
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
		  "from": "1704893381544",
		  "to": "1704914981544"
		}`), &randomWalkTable)

	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{},
		Namespace: []builder.APIRouteHandler{
			{
				Path: "query",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"query"},
							Description: "query across multiple datasources with expressions.  This api matches the legacy /ds/query endpoint",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										Description: "object name and auth scope, such as for teams and projects",
										In:          "path",
										Required:    true,
										Schema:      spec.StringProperty(),
										Example:     "default",
									},
								},
							},
							RequestBody: &spec3.RequestBody{
								RequestBodyProps: spec3.RequestBodyProps{
									Required:    true,
									Description: "the query array",
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema: querySchema.WithExample(randomWalkQuery),
												Examples: map[string]*spec3.Example{
													"random_walk": {
														ExampleProps: spec3.ExampleProps{
															Summary: "random walk",
															Value:   randomWalkQuery,
														},
													},
													"random_walk_table": {
														ExampleProps: spec3.ExampleProps{
															Summary: "random walk (table)",
															Value:   randomWalkTable,
														},
													},
												},
											},
										},
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										http.StatusOK: {
											ResponseProps: spec3.ResponseProps{
												Description: "Query results",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &responseSchema,
														},
													},
												},
											},
										},
										http.StatusMultiStatus: {
											ResponseProps: spec3.ResponseProps{
												Description: "Errors exist in the downstream results",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &responseSchema,
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.handleQuery,
			},
		},
	}
}

func (b *QueryAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default is OK
}

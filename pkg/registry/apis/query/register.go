package query

import (
	"context"
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

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"github.com/prometheus/client_golang/prometheus"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	features               featuremgmt.FeatureToggles

	tracer   tracing.Tracer
	metrics  *metrics
	parser   *queryParser
	runner   v0alpha1.QueryRunner
	registry v0alpha1.DataSourceApiServerRegistry
	expr     *exprStorage
}

func NewQueryAPIBuilder(features featuremgmt.FeatureToggles,
	runner v0alpha1.QueryRunner,
	registry v0alpha1.DataSourceApiServerRegistry,
	legacy LegacyLookupFunction,
	registerer prometheus.Registerer,
	tracer tracing.Tracer,
) (*QueryAPIBuilder, error) {
	reader := expr.NewExpressionQueryReader(features)
	expr, err := newExprStorage(reader)
	return &QueryAPIBuilder{
		concurrentQueryLimit: 4,
		log:                  log.New("query_apiserver"),
		returnMultiStatus:    features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryMultiStatus),
		runner:               runner,
		registry:             registry,
		expr:                 expr,
		parser:               newQueryParser(reader, legacy, tracer),
		metrics:              newMetrics(registerer),
		tracer:               tracer,
		features:             features,
	}, err
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
) (*QueryAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	legacy := func(ctx context.Context, name string, id int64) *resource.DataSourceRef {
		ctx, span := tracer.Start(ctx, "QueryService.LegacyLookup")
		defer span.End()
		return nil // TODO... SQL calls
	}

	builder, err := NewQueryAPIBuilder(
		features,
		runner.NewDirectQueryRunner(pluginClient, pCtxProvider),
		runner.NewDirectRegistry(pluginStore, dataSourcesService),
		legacy, registerer, tracer,
	)

	// ONLY testdata...
	if false {
		builder, err = NewQueryAPIBuilder(
			features,
			runner.NewDummyTestRunner(),
			runner.NewDummyRegistry(),
			legacy, registerer, tracer,
		)
	}

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

	storage[b.expr.resourceInfo.StoragePath()] = b.expr
	storage[b.expr.resourceInfo.StoragePath("validate")] = &validateQueryREST{s: b.expr}

	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *QueryAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	//defs := v0alpha1.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	//	querySchema := defs["github.com/grafana/grafana/pkg/apis/query/v0alpha1.QueryRequest"].Schema
	//responseSchema := defs["github.com/grafana/grafana/pkg/apis/query/v0alpha1.QueryDataResponse"].Schema

	// var randomWalkQuery any
	// var randomWalkTable any
	// _ = json.Unmarshal([]byte(`{
	// 	"queries": [
	// 	  {
	// 		"refId": "A",
	// 		"scenarioId": "random_walk",
	// 		"seriesCount": 1,
	// 		"datasource": {
	// 		  "type": "grafana-testdata-datasource",
	// 		  "uid": "PD8C576611E62080A"
	// 		},
	// 		"intervalMs": 60000,
	// 		"maxDataPoints": 20
	// 	  }
	// 	],
	// 	"from": "1704893381544",
	// 	"to": "1704914981544"
	//   }`), &randomWalkQuery)

	// _ = json.Unmarshal([]byte(`{
	// 	  "queries": [
	// 		{
	// 		  "refId": "A",
	// 		  "scenarioId": "random_walk_table",
	// 		  "seriesCount": 1,
	// 		  "datasource": {
	// 			"type": "grafana-testdata-datasource",
	// 			"uid": "PD8C576611E62080A"
	// 		  },
	// 		  "intervalMs": 60000,
	// 		  "maxDataPoints": 20
	// 		}
	// 	  ],
	// 	  "from": "1704893381544",
	// 	  "to": "1704914981544"
	// 	}`), &randomWalkTable)

	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "expressions.schema.json",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"QueryTypeDefinition"},
							Description: "get a single json schema for the query type",
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										http.StatusOK: {
											ResponseProps: spec3.ResponseProps{
												Description: "Query results",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Type:                 []string{"object"},
																	AdditionalProperties: &spec.SchemaOrBool{Allows: true},
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
					},
				},
				Handler: b.handleExpressionsSchema,
			},
		},
		// Namespace: []builder.APIRouteHandler{
		// 	{
		// 		Path: "query",
		// 		Spec: &spec3.PathProps{
		// 			Post: &spec3.Operation{
		// 				OperationProps: spec3.OperationProps{
		// 					Tags:        []string{"query"},
		// 					Description: "query across multiple datasources with expressions.  This api matches the legacy /ds/query endpoint",
		// 					Parameters: []*spec3.Parameter{
		// 						{
		// 							ParameterProps: spec3.ParameterProps{
		// 								Name:        "namespace",
		// 								Description: "object name and auth scope, such as for teams and projects",
		// 								In:          "path",
		// 								Required:    true,
		// 								Schema:      spec.StringProperty(),
		// 								Example:     "default",
		// 							},
		// 						},
		// 					},
		// 					RequestBody: &spec3.RequestBody{
		// 						RequestBodyProps: spec3.RequestBodyProps{
		// 							Required:    true,
		// 							Description: "the query array",
		// 							Content: map[string]*spec3.MediaType{
		// 								"application/json": {
		// 									MediaTypeProps: spec3.MediaTypeProps{
		// 										Schema: querySchema.WithExample(randomWalkQuery),
		// 										Examples: map[string]*spec3.Example{
		// 											"random_walk": {
		// 												ExampleProps: spec3.ExampleProps{
		// 													Summary: "random walk",
		// 													Value:   randomWalkQuery,
		// 												},
		// 											},
		// 											"random_walk_table": {
		// 												ExampleProps: spec3.ExampleProps{
		// 													Summary: "random walk (table)",
		// 													Value:   randomWalkTable,
		// 												},
		// 											},
		// 										},
		// 									},
		// 								},
		// 							},
		// 						},
		// 					},
		// 					Responses: &spec3.Responses{
		// 						ResponsesProps: spec3.ResponsesProps{
		// 							StatusCodeResponses: map[int]*spec3.Response{
		// 								http.StatusOK: {
		// 									ResponseProps: spec3.ResponseProps{
		// 										Description: "Query results",
		// 										Content: map[string]*spec3.MediaType{
		// 											"application/json": {
		// 												MediaTypeProps: spec3.MediaTypeProps{
		// 													Schema: &responseSchema,
		// 												},
		// 											},
		// 										},
		// 									},
		// 								},
		// 								http.StatusMultiStatus: {
		// 									ResponseProps: spec3.ResponseProps{
		// 										Description: "Errors exist in the downstream results",
		// 										Content: map[string]*spec3.MediaType{
		// 											"application/json": {
		// 												MediaTypeProps: spec3.MediaTypeProps{
		// 													Schema: &responseSchema,
		// 												},
		// 											},
		// 										},
		// 									},
		// 								},
		// 							},
		// 						},
		// 					},
		// 				},
		// 			},
		// 		},
		// 		Handler: b.handleQuery,
		// 	},
		// },
	}
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

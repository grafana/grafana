package query

import (
	"encoding/json"

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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

var _ grafanaapiserver.APIGroupBuilder = (*QueryAPIBuilder)(nil)

type QueryAPIBuilder struct {
	log                    log.Logger
	concurrentQueryLimit   int
	UserFacingDefaultError string
}

func NewQueryAPIBuilder() *QueryAPIBuilder {
	return &QueryAPIBuilder{
		concurrentQueryLimit: 4, // from config?
		log:                  log.New("query_apiserver"),
	}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *QueryAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewQueryAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *QueryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.DataSource{},
		&v0alpha1.DataSourceList{},
		&v0alpha1.DataSourcePlugin{},
		&v0alpha1.DataSourcePluginList{},
		&v0alpha1.QueryResults{},
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
) (*genericapiserver.APIGroupInfo, error) {
	gv := v0alpha1.SchemeGroupVersion
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(gv.Group, scheme, metav1.ParameterCodec, codecs)

	cache, err := initRegistry()
	if err != nil {
		return nil, err
	}

	ds := newDataSourceStorage(cache)
	plugins := newPluginsStorage(cache)

	storage := map[string]rest.Storage{}
	storage[ds.resourceInfo.StoragePath()] = ds
	storage[plugins.resourceInfo.StoragePath()] = plugins

	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *QueryAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	defs := v0alpha1.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	querySchema := defs["github.com/grafana/grafana/pkg/apis/query/v0alpha1.QueryRequest"].Schema

	var exampleQuery any
	json.Unmarshal([]byte(`{
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
			"maxDataPoints": 462
		  }
		],
		"from": "1704893381544",
		"to": "1704914981544"
	  }`), &exampleQuery)

	return &grafanaapiserver.APIRoutes{
		Root: []grafanaapiserver.APIRouteHandler{},
		Namespace: []grafanaapiserver.APIRouteHandler{
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
												Schema: querySchema.WithExample(exampleQuery),
											},
										},
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "the query results",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: spec.MapProperty(spec.StringProperty()),
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

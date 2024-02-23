package peakq

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*PeakQAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PeakQAPIBuilder struct{}

func NewPeakQAPIBuilder() *PeakQAPIBuilder {
	return &PeakQAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar) *PeakQAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewPeakQAPIBuilder()
	apiregistration.RegisterAPI(NewPeakQAPIBuilder())
	return builder
}

func (b *PeakQAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *PeakQAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return peakq.SchemeGroupVersion
}

func (b *PeakQAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := peakq.SchemeGroupVersion
	err := peakq.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   peakq.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *PeakQAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ bool, // dual write (not relevant)
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(peakq.GROUP, scheme, metav1.ParameterCodec, codecs)

	resourceInfo := peakq.QueryTemplateResourceInfo
	storage := map[string]rest.Storage{}
	peakqStorage, err := newStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[resourceInfo.StoragePath()] = peakqStorage
	storage[resourceInfo.StoragePath("render")] = &renderREST{
		getter: peakqStorage,
	}

	apiGroupInfo.VersionedResourcesStorageMap[peakq.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *PeakQAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return peakq.GetOpenAPIDefinitions
}

// NOT A GREAT APPROACH... BUT will make a UI for statically defined
func (b *PeakQAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := peakq.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	renderedQuerySchema := defs["github.com/grafana/grafana/pkg/apis/peakq/v0alpha1.RenderedQuery"].Schema
	queryTemplateSpecSchema := defs["github.com/grafana/grafana/pkg/apis/peakq/v0alpha1.QueryTemplateSpec"].Schema

	params := []*spec3.Parameter{
		{
			ParameterProps: spec3.ParameterProps{
				// Arbitrary name. It won't appear in the request URL,
				// but will be used in code generated from this OAS spec
				Name:        "variables",
				In:          "query",
				Schema:      spec.MapProperty(spec.ArrayProperty(spec.StringProperty())),
				Style:       "form",
				Explode:     true,
				Description: "Each variable is prefixed with var-{variable}={value}",
				Example: map[string][]string{
					"var-metricName": {"up"},
					"var-another":    {"first", "second"},
				},
			},
		},
	}
	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "render",
				Spec: &spec3.PathProps{
					Summary:     "an example at the root level",
					Description: "longer description here?",
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Parameters: params,
							RequestBody: &spec3.RequestBody{
								RequestBodyProps: spec3.RequestBodyProps{
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema: &queryTemplateSpecSchema,
												//	Example: basicTemplateSpec,
												Examples: map[string]*spec3.Example{
													"test": {
														ExampleProps: spec3.ExampleProps{
															Summary: "hello",
															Value:   basicTemplateSpec,
														},
													},
													"test2": {
														ExampleProps: spec3.ExampleProps{
															Summary: "hello2",
															Value:   basicTemplateSpec,
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
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "OK",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &renderedQuerySchema,
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
				Handler: renderPOSTHandler,
			},
		},
	}
}

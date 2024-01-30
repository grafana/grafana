package peakq

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
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

var _ grafanaapiserver.APIGroupBuilder = (*PeakQAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PeakQAPIBuilder struct{}

func NewPeakQAPIBuilder() *PeakQAPIBuilder {
	return &PeakQAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *PeakQAPIBuilder {
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
func (b *PeakQAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	defs := peakq.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	renderedQuerySchema := defs["github.com/grafana/grafana/pkg/apis/peakq/v0alpha1.RenderedQuery"].Schema
	queryTemplateSpecSchema := defs["github.com/grafana/grafana/pkg/apis/peakq/v0alpha1.QueryTemplateSpec"].Schema
	playgroundExample := basicTemplateWithSelectedValue

	params := []*spec3.Parameter{
		{
			ParameterProps: spec3.ParameterProps{
				Name:    "metricName",
				In:      "query",
				Schema:  spec.StringProperty(),
				Example: "up",
			},
		},
	}

	return &grafanaapiserver.APIRoutes{
		Root: []grafanaapiserver.APIRouteHandler{
			{
				Path: "playground",
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
												Schema:  &queryTemplateSpecSchema,
												Example: basicTemplateWithSelectedValue,
												Examples: map[string]*spec3.Example{
													"test": {
														ExampleProps: spec3.ExampleProps{
															Summary: "hello",
															Value:   basicTemplateWithSelectedValue,
														},
													},
													"test2": {
														ExampleProps: spec3.ExampleProps{
															Summary: "hello2",
															Value:   basicTemplateWithSelectedValue,
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
				Handler: func(w http.ResponseWriter, r *http.Request) {
					input := map[string]string{}
					for key, vals := range r.URL.Query() {
						if len(vals) > 0 {
							input[key] = vals[0] // ignore second values?
						}
					}

					results, err := Render(playgroundExample, input)
					if err != nil {
						_, _ = w.Write([]byte("ERROR: " + err.Error()))
						w.WriteHeader(500)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_ = json.NewEncoder(w).Encode(results)
				},
			},
		},
	}
}

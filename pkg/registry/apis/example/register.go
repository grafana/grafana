package example

import (
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

// GroupName is the group name for this API.
const GroupName = "example.grafana.app"
const VersionID = "v0alpha1" //

var _ grafanaapiserver.APIGroupBuilder = (*TestingAPIBuilder)(nil)

// This is used just so wire has something unique to return
type TestingAPIBuilder struct {
	groupVersion schema.GroupVersion
	codecs       serializer.CodecFactory
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *TestingAPIBuilder {
	if !features.IsEnabled(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := &TestingAPIBuilder{
		groupVersion: schema.GroupVersion{Group: GroupName, Version: VersionID},
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *TestingAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *TestingAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.groupVersion,
		&example.RuntimeInfo{},
		&example.DummyResource{},
		&example.DummyResourceList{},
	)
	metav1.AddToGroupVersion(scheme, b.groupVersion)
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *TestingAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}
	// NOT NamespaceScoped!
	storage["runtime"] = newRuntimeInfoStorage(b.groupVersion.WithResource("runtime"))
	// NamespaceScoped, with three resources (and subresources added from APIRoutes)
	storage["dummy"] = newDummyStorage(
		b.groupVersion.WithResource("dummy"),
		"test1", "test2", "test3",
	)
	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	b.codecs = codecs
	return &apiGroupInfo, nil
}

func (b *TestingAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return example.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *TestingAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{
		Root: []grafanaapiserver.APIRouteHandler{
			{
				Path: "/aaa",
				Spec: &spec3.PathProps{
					Summary:     "an example at the root level",
					Description: "longer description here?",
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Parameters: []*spec3.Parameter{
								{ParameterProps: spec3.ParameterProps{
									Name: "a",
								}},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "OK",
												Content: map[string]*spec3.MediaType{
													"text/plain": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Type: []string{"string"},
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
				Handler: func(w http.ResponseWriter, r *http.Request) {
					_, _ = w.Write([]byte("Root level handler (aaa)"))
				},
			},
			{
				Path: "/bbb",
				Spec: &spec3.PathProps{
					Summary:     "an example at the root level",
					Description: "longer description here?",
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Parameters: []*spec3.Parameter{
								{ParameterProps: spec3.ParameterProps{
									Name: "b",
								}},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					_, _ = w.Write([]byte("Root level handler (bbb)"))
				},
			},
		},
		Namespace: []grafanaapiserver.APIRouteHandler{
			{
				Path: "/ccc",
				Spec: &spec3.PathProps{
					Summary:     "an example at the root level",
					Description: "longer description here?",
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Parameters: []*spec3.Parameter{
								{ParameterProps: spec3.ParameterProps{
									Name: "a",
								}},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					info, ok := request.RequestInfoFrom(r.Context())
					if !ok {
						responsewriters.ErrorNegotiated(
							apierrors.NewInternalError(fmt.Errorf("no RequestInfo found in the context")),
							b.codecs, schema.GroupVersion{}, w, r,
						)
						return
					}

					_, _ = w.Write([]byte("Custom namespace route ccc: " + info.Namespace))
				},
			},
		},
		Resource: map[string][]grafanaapiserver.APIRouteHandler{
			"dummy": {
				{
					Path: "/ddd",
					Spec: &spec3.PathProps{
						Summary:     "an example at the root level",
						Description: "longer description here?",
						Get: &spec3.Operation{
							OperationProps: spec3.OperationProps{
								Parameters: []*spec3.Parameter{
									{ParameterProps: spec3.ParameterProps{
										Name: "a",
									}},
								},
							},
						},
					},
					Handler: func(w http.ResponseWriter, r *http.Request) {
						info, ok := request.RequestInfoFrom(r.Context())
						if !ok {
							responsewriters.ErrorNegotiated(
								apierrors.NewInternalError(fmt.Errorf("no RequestInfo found in the context")),
								b.codecs, schema.GroupVersion{}, w, r,
							)
							return
						}

						msg := fmt.Sprintf("Custom resource route (ddd)\n\n%+v", info)
						_, _ = w.Write([]byte(msg))
					},
				},
			},
		},
	}
}

// SchemeGroupVersion is group version used to register these objects
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: VersionID}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

var (
	// SchemeBuilder points to a list of functions added to Scheme.
	SchemeBuilder      = runtime.NewSchemeBuilder(addKnownTypes)
	localSchemeBuilder = &SchemeBuilder
	// AddToScheme is a common registration function for mapping packaged scoped group & version keys to a scheme.
	AddToScheme = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&example.RuntimeInfo{},
	)

	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return scheme.SetVersionPriority(SchemeGroupVersion)
}

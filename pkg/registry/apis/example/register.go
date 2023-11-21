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
const APIVersion = GroupName + "/" + VersionID

var _ grafanaapiserver.APIGroupBuilder = (*TestingAPIBuilder)(nil)

// This is used just so wire has something unique to return
type TestingAPIBuilder struct {
	codecs serializer.CodecFactory
	gv     schema.GroupVersion
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *TestingAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := &TestingAPIBuilder{
		gv: schema.GroupVersion{Group: GroupName, Version: VersionID},
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *TestingAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&example.RuntimeInfo{},
		&example.DummyResource{},
		&example.DummyResourceList{},
		&example.DummySubresource{},
	)
}

func (b *TestingAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, b.gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *TestingAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	b.codecs = codecs
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)

	storage := map[string]rest.Storage{}
	storage["runtime"] = newDeploymentInfoStorage(b.gv, scheme)
	storage["dummy"] = newDummyStorage(b.gv, scheme, "test1", "test2", "test3")
	storage["dummy/sub"] = &dummySubresourceREST{}
	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
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
	}
}

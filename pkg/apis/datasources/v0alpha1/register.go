package v0alpha1

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

const VersionID = "v0alpha1" //

var _ grafanaapiserver.APIGroupBuilder = (*DSAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DSAPIBuilder struct {
	groupVersion schema.GroupVersion
	apiVersion   string
	plugin       any
}

func newDSAPIBuilder(plugin string) *DSAPIBuilder {
	groupVersion := schema.GroupVersion{
		Group:   fmt.Sprintf("%s.ds.grafana.com", plugin),
		Version: VersionID,
	}
	return &DSAPIBuilder{
		plugin:       plugin,
		groupVersion: groupVersion,
		apiVersion:   groupVersion.String(),
	}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *DSAPIBuilder {
	if !features.IsEnabled(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	ds := []*DSAPIBuilder{
		newDSAPIBuilder("a"),
		newDSAPIBuilder("b"),
		newDSAPIBuilder("c"),
	}
	for _, v := range ds {
		apiregistration.RegisterAPI(v)
	}
	return ds[0] // only used for wire
}

func (b *DSAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *DSAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.groupVersion,
		&DataSourceConfig{},
		&DataSourceConfigList{},
		&InstanceInfo{},
		&InstanceInfoList{},
	)
	metav1.AddToGroupVersion(scheme, b.groupVersion)
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *DSAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(
		b.groupVersion.Group, scheme,
		metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}
	// instance is usage access
	storage["instance"] = &instanceStorage{
		apiVersion: b.apiVersion,
		groupResource: schema.GroupResource{
			Group:    b.groupVersion.Group,
			Resource: "instance",
		},
	}
	// config is for execution access
	storage["config"] = &configStorage{
		apiVersion: b.apiVersion,
		groupResource: schema.GroupResource{
			Group:    b.groupVersion.Group,
			Resource: "config",
		},
	}
	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *DSAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return getOpenAPIDefinitions
}

// Register additional routes with the server
func (b *DSAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{
		Resource: map[string][]grafanaapiserver.APIRouteHandler{
			"instance": {
				{
					Path: "/query",
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
							fmt.Printf("ERROR!!!!")
							return
						}

						_, _ = w.Write([]byte("TODO.... actually query " + info.Namespace))
					},
				}},
		},
	}
}

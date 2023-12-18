package service

import (
	service "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

var _ grafanaapiserver.APIGroupBuilder = (*ServiceAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ServiceAPIBuilder struct {
	codecs serializer.CodecFactory
	gv     schema.GroupVersion
}

func NewServiceAPIBuilder() *ServiceAPIBuilder {
	return &ServiceAPIBuilder{
		gv: schema.GroupVersion{Group: service.GROUP, Version: service.VERSION},
	}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *ServiceAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewServiceAPIBuilder()
	apiregistration.RegisterAPI(NewServiceAPIBuilder())
	return builder
}

func (b *ServiceAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&service.ExternalName{},
		&service.ExternalNameList{},
	)
}

func (b *ServiceAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
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

func (b *ServiceAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	b.codecs = codecs
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(b.gv.Group, scheme, metav1.ParameterCodec, codecs)

	storage := map[string]rest.Storage{}
	serviceStorage, err := newStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[service.ExternalNameResourceInfo.StoragePath()] = serviceStorage
	apiGroupInfo.VersionedResourcesStorageMap[b.gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *ServiceAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return service.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *ServiceAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{}
}

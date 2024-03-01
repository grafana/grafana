package service

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

	service "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*ServiceAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ServiceAPIBuilder struct{}

func NewServiceAPIBuilder() *ServiceAPIBuilder {
	return &ServiceAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar) *ServiceAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesAggregator) {
		return nil // skip registration unless opting into aggregator mode
	}

	builder := NewServiceAPIBuilder()
	apiregistration.RegisterAPI(NewServiceAPIBuilder())
	return builder
}

func (b *ServiceAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *ServiceAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return service.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&service.ExternalName{},
		&service.ExternalNameList{},
	)
}

func (b *ServiceAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := service.SchemeGroupVersion
	err := service.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   service.GROUP,
		Version: runtime.APIVersionInternal,
	})
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *ServiceAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ bool,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(service.GROUP, scheme, metav1.ParameterCodec, codecs)

	resourceInfo := service.ExternalNameResourceInfo
	storage := map[string]rest.Storage{}
	serviceStorage, err := newStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[resourceInfo.StoragePath()] = serviceStorage
	apiGroupInfo.VersionedResourcesStorageMap[service.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *ServiceAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return service.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *ServiceAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

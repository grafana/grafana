package frontendnotification

import (
	frontendnotification "github.com/grafana/grafana/pkg/apis/frontendnotification/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

var _ builder.APIGroupBuilder = (*FrontendNotificationAPIBuilder)(nil)

type FrontendNotificationAPIBuilder struct {
	accessControl accesscontrol.AccessControl
	registryStore grafanarest.Storage
}

func RegisterAPIService(apiregistration builder.APIRegistrar, accessControl accesscontrol.AccessControl) *FrontendNotificationAPIBuilder {
	builder := &FrontendNotificationAPIBuilder{accessControl: accessControl}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *FrontendNotificationAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return frontendnotification.SchemeGroupVersion
}

func (b *FrontendNotificationAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := frontendnotification.SchemeGroupVersion
	err := frontendnotification.AddToScheme(scheme)
	if err != nil {
		return err
	}
	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   frontendnotification.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *FrontendNotificationAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := frontendnotification.FrontendNotificationResourceInfo
	storage := map[string]rest.Storage{}
	registryStore, err := newStorage(opts.Scheme, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[resourceInfo.StoragePath()] = registryStore
	b.registryStore = registryStore

	apiGroupInfo.VersionedResourcesStorageMap[frontendnotification.VERSION] = storage
	return nil
}

func (b *FrontendNotificationAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return frontendnotification.GetOpenAPIDefinitions
}

func (b *FrontendNotificationAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}

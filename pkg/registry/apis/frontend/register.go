package frontend

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/frontend/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*FrontendAPIBuilder)(nil)

// This is used just so wire has something unique to return
type FrontendAPIBuilder struct {
	store *extensionStorage
}

func NewFrontendAPIBuilder() *FrontendAPIBuilder {
	return &FrontendAPIBuilder{
		store: newStaticStorage(),
	}
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
) *FrontendAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewFrontendAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *FrontendAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.store.info.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.ExtensionResource{},
		&v0alpha1.ExtensionResourceList{},
	)
}

func (b *FrontendAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.store.info.GroupVersion()
	addKnownTypes(scheme, gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *FrontendAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	_ bool, // dual write
) (*genericapiserver.APIGroupInfo, error) {
	resource := b.store.info
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(resource.GroupVersion().Group,
		scheme, metav1.ParameterCodec, codecs)

	storage := map[string]rest.Storage{}
	storage[resource.StoragePath()] = b.store
	apiGroupInfo.VersionedResourcesStorageMap[resource.GroupVersion().Version] = storage
	return &apiGroupInfo, nil
}

func (b *FrontendAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *FrontendAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (b *FrontendAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}

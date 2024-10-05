package secret

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
)

var _ builder.APIGroupBuilder = (*SecretAPIBuilder)(nil)

type SecretAPIBuilder struct {
	store   secretstore.SecureValueStore
	manager secretstore.SecretManager
}

func NewSecretAPIBuilder(store secretstore.SecureValueStore, manager secretstore.SecretManager) *SecretAPIBuilder {
	return &SecretAPIBuilder{store, manager}
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	store secretstore.SecureValueStore,
	manager secretstore.SecretManager,
) *SecretAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := NewSecretAPIBuilder(store, manager)
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *SecretAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return secret.SecureValuesResourceInfo.GroupVersion()
}

func (b *SecretAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	secret.AddKnownTypes(scheme, secret.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	secret.AddKnownTypes(scheme, runtime.APIVersionInternal)

	metav1.AddToGroupVersion(scheme, secret.SchemeGroupVersion)
	return scheme.SetVersionPriority(secret.SchemeGroupVersion)
}

func (b *SecretAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, _ grafanarest.DualWriteBuilder) error {
	resource := secret.SecureValuesResourceInfo
	storage := map[string]rest.Storage{}
	storage[resource.StoragePath()] = &secretStorage{
		store:          b.store,
		resource:       resource,
		tableConverter: resource.TableConverter(),
	}
	storage[resource.StoragePath("decrypt")] = &secretDecrypt{
		store: b.store,
	}
	storage[resource.StoragePath("history")] = &secretHistory{
		store: b.store,
	}

	err := b.manager.InitStorage(scheme, storage, optsGetter)
	if err != nil {
		return nil
	}

	apiGroupInfo.VersionedResourcesStorageMap[secret.VERSION] = storage
	return nil
}

func (b *SecretAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return secret.GetOpenAPIDefinitions
}

func (b *SecretAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	// TODO... who can create secrets? must be multi-tenant first
	return nil // start with the default authorizer
}

// Register additional routes with the server
func (b *SecretAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

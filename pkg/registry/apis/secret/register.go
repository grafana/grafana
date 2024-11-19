package secret

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
)

var _ builder.APIGroupBuilder = (*SecretAPIBuilder)(nil)

type SecretAPIBuilder struct {
	config  *setting.Cfg
	store   secretstore.SecureValueStore
	manager secretstore.SecretManager
}

func NewSecretAPIBuilder(config *setting.Cfg, store secretstore.SecureValueStore, manager secretstore.SecretManager) *SecretAPIBuilder {
	return &SecretAPIBuilder{config, store, manager}
}

func RegisterAPIService(
	config *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	store secretstore.SecureValueStore,
	manager secretstore.SecretManager,
) *SecretAPIBuilder {
	// Skip registration unless opting into experimental apis and the secrets management app platform flag.
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return nil
	}

	builder := NewSecretAPIBuilder(config, store, manager)
	apiregistration.RegisterAPI(builder)
	return builder
}

// GetGroupVersion returns the tuple of `group` and `version` for the API which uniquely identifies it.
func (b *SecretAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return secret.SchemeGroupVersion
}

// InstallSchema is called by the `apiserver` which exposes the defined kinds.
func (b *SecretAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	secret.AddKnownTypes(scheme, secret.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	secret.AddKnownTypes(scheme, runtime.APIVersionInternal)

	// Internal Kubernetes metadata API. Presumably to display the available APIs?
	// e.g. http://localhost:3000/apis/secret.grafana.app/v0alpha1
	metav1.AddToGroupVersion(scheme, secret.SchemeGroupVersion)

	// This sets the priority in case we have multiple versions.
	// By default Kubernetes will only let you use `kubectl get <resource>` with one version.
	// In case there are multiple versions, we'd need to pass the full path with the `--raw` flag.
	if err := scheme.SetVersionPriority(secret.SchemeGroupVersion); err != nil {
		return fmt.Errorf("scheme set version priority: %w", err)
	}

	return nil
}

// UpdateAPIGroupInfo is called when creating a generic API server for this group of kinds.
func (b *SecretAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	secureValueResource := secret.SecureValuesResourceInfo

	// rest.Storage is a generic interface for RESTful storage services.
	// The constructors need to at least implement this interface, but will most likely implement
	// other interfaces that equal to different operations like `get`, `list` and so on.
	secureValueStorage := map[string]rest.Storage{
		// Default path for `securevalue`.
		// The `restStorage` struct will implement interfaces for CRUDL operations on `securevalue`.
		secureValueResource.StoragePath(): &secureValueRESTStorage{
			store:          b.store,
			resource:       secureValueResource,
			tableConverter: secureValueResource.TableConverter(),
		},

		// This is a subresource from `securevalue`. It gets accessed like `securevalue/xyz/decrypt`.
		// Not yet supported by grafana-app-sdk or unified storage.
		secureValueResource.StoragePath("decrypt"): &secretDecrypt{
			config: b.config,
			store:  b.store,
		},

		// This is a subresrouce from `securevalue`. It gets accessed like `securevalue/xyz/history`.
		// Not yet supported by grafana-app-sdk or unified storage.
		secureValueResource.StoragePath("history"): &secretHistory{
			store: b.store,
		},
	}

	// This does not do anything here. Shouldn't it also use the keymanager resource? TODO!
	err := b.manager.InitStorage(opts.Scheme, secureValueStorage, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("secret manager init storage: %w", err)
	}

	apiGroupInfo.VersionedResourcesStorageMap[secret.VERSION] = secureValueStorage
	return nil
}

// GetOpenAPIDefinitions, is this only for documentation?
func (b *SecretAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return secret.GetOpenAPIDefinitions
}

// GetAuthorizer: [TODO] who can create secrets? must be multi-tenant first
func (b *SecretAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	// This is TBD being defined with IAM.

	return nil // start with the default authorizer
}

// Register additional routes with the server.
func (b *SecretAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

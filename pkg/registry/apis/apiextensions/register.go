package apiextensions

import (
	"github.com/prometheus/client_golang/prometheus"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	apiextensionsopenapi "k8s.io/apiextensions-apiserver/pkg/generated/openapi"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// CRDStorageProvider is an interface for creating CRD REST options getters.
// Enterprise provides the real implementation, OSS returns nil.
type CRDStorageProvider interface {
	NewCRDRESTOptionsGetter(
		delegate *apistore.RESTOptionsGetter,
		unifiedClient resource.ResourceClient,
	) genericregistry.RESTOptionsGetter
}

// OSSCRDStorageProvider is the OSS implementation that returns nil (feature disabled)
type OSSCRDStorageProvider struct{}

func ProvideOSSCRDStorageProvider() CRDStorageProvider {
	return &OSSCRDStorageProvider{}
}

func (p *OSSCRDStorageProvider) NewCRDRESTOptionsGetter(
	delegate *apistore.RESTOptionsGetter,
	unifiedClient resource.ResourceClient,
) genericregistry.RESTOptionsGetter {
	return nil
}

var _ builder.APIGroupBuilder = (*Builder)(nil)

// Builder implements builder.APIGroupBuilder for CustomResourceDefinitions.
// This implementation uses the Kubernetes apiextensions-apiserver for CRD handling,
// adapted to work with Grafana's unified storage backend.
//
// IMPORTANT: This builder only registers the CRD types with the scheme.
// The actual CRD storage and custom resource handling is done by the
// Kubernetes apiextensions-apiserver, which is created separately and
// chained as a delegate server.
type Builder struct {
	features            featuremgmt.FeatureToggles
	accessClient        authlib.AccessClient
	unifiedClient       resource.ResourceClient
	apiExtensionsServer *apiextensionsapiserver.CustomResourceDefinitions
	storageProvider     CRDStorageProvider
}

// RegisterAPIService registers the apiextensions API group in single-tenant mode
func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	accessClient authlib.AccessClient,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
	storageProvider CRDStorageProvider,
) (*Builder, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagApiExtensions) {
		return nil, nil
	}

	b := &Builder{
		features:        features,
		accessClient:    accessClient,
		unifiedClient:   unified,
		storageProvider: storageProvider,
	}

	// Register the builder to install the schema
	apiregistration.RegisterAPI(b)

	return b, nil
}

// GetAuthorizer returns the authorizer for CRD resources
// Breaks locally now for ST, will need to test in MT
// For ST just comment this out to test
// func (b *Builder) GetAuthorizer() authorizer.Authorizer {
// 	return grafanaauthorizer.NewServiceAuthorizer()
// }

// NewAPIService creates an Builder for multi-tenant mode
func NewAPIService(
	accessClient authlib.AccessClient,
	unified resource.ResourceClient,
	registerer prometheus.Registerer,
	features featuremgmt.FeatureToggles,
	storageProvider CRDStorageProvider,
) (*Builder, error) {
	return &Builder{
		features:        features,
		accessClient:    accessClient,
		unifiedClient:   unified,
		storageProvider: storageProvider,
	}, nil
}

// GetGroupVersion returns the API group version for apiextensions.k8s.io/v1
func (b *Builder) GetGroupVersion() schema.GroupVersion {
	return apiextensionsv1.SchemeGroupVersion
}

// InstallSchema installs the CRD types into the scheme
func (b *Builder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()

	// Register the apiextensions types from the K8s apiextensions-apiserver
	// This uses the types and scheme from the K8s package
	metav1.AddToGroupVersion(scheme, gv)

	// Add the CRD types to the scheme
	scheme.AddKnownTypes(gv,
		&apiextensionsv1.CustomResourceDefinition{},
		&apiextensionsv1.CustomResourceDefinitionList{},
	)

	return scheme.SetVersionPriority(gv)
}

func (b *Builder) AllowedV0Alpha1Resources() []string {
	return nil
}

// UpdateAPIGroupInfo is a no-op for the apiextensions builder.
// The actual CRD storage is created by the apiextensions server, not the builder.
// This is called by the builder framework but we don't need to do anything here
// since we're using the K8s apiextensions-apiserver which creates its own storage.
func (b *Builder) UpdateAPIGroupInfo(
	_ *genericapiserver.APIGroupInfo,
	_ builder.APIGroupOptions,
) error {
	// Don't install any storage here - the apiextensions server handles this
	return nil
}

// GetOpenAPIDefinitions returns the OpenAPI definitions for CRD types
func (b *Builder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return apiextensionsopenapi.GetOpenAPIDefinitions(ref)
	}
}

// CreateAPIExtensionsServer creates the Kubernetes apiextensions-apiserver
// This server handles CRD storage and custom resource (CR) handling.
// It should be used as a delegate for the main Grafana API server.
func (b *Builder) CreateAPIExtensionsServer(
	serverConfig genericapiserver.RecommendedConfig,
	delegationTarget genericapiserver.DelegationTarget,
	restOptsGetter *apistore.RESTOptionsGetter,
) (*apiextensionsapiserver.CustomResourceDefinitions, error) {
	if restOptsGetter == nil {
		return nil, nil
	}

	// Create the CRD REST options getter that uses unified storage
	crdRestOptsGetter := b.storageProvider.NewCRDRESTOptionsGetter(restOptsGetter, b.unifiedClient)
	if crdRestOptsGetter == nil {
		// Enterprise feature not available
		return nil, nil
	}

	// Create a fresh copy of the config for the apiextensions server
	// We need to clear PostStartHooks to avoid conflicts with hooks
	// already registered by the main server (e.g., "playlist")
	apiExtensionsGenericConfig := serverConfig
	apiExtensionsGenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	// Set the RESTOptionsGetter on the GenericConfig
	// The K8s apiextensions-apiserver uses GenericConfig.RESTOptionsGetter for CRD storage
	// and ExtraConfig.CRDRESTOptionsGetter for Custom Resource storage
	apiExtensionsGenericConfig.RESTOptionsGetter = crdRestOptsGetter

	// Enable the CRD resources in the API resource config
	apiResourceConfig := serverstorage.NewResourceConfig()
	apiResourceConfig.EnableVersions(apiextensionsv1.SchemeGroupVersion)
	apiExtensionsGenericConfig.MergedResourceConfig = apiResourceConfig

	// Configure the apiextensions server
	apiextensionsConfig := &apiextensionsapiserver.Config{
		GenericConfig: &apiExtensionsGenericConfig,
		ExtraConfig: apiextensionsapiserver.ExtraConfig{
			// CRDRESTOptionsGetter is used for Custom Resource (CR) storage, not CRD storage
			CRDRESTOptionsGetter: crdRestOptsGetter,
			MasterCount:          1,
			// Webhook conversion is not supported yet
			ServiceResolver:     nil,
			AuthResolverWrapper: nil,
		},
	}

	server, err := apiextensionsConfig.Complete().New(delegationTarget)
	if err != nil {
		return nil, err
	}

	b.apiExtensionsServer = server
	return server, nil
}

// GetAPIExtensionsServer returns the apiextensions server (if created)
func (b *Builder) GetAPIExtensionsServer() *apiextensionsapiserver.CustomResourceDefinitions {
	return b.apiExtensionsServer
}

// SetAPIServer is a no-op for compatibility with the builder interface
func (b *Builder) SetAPIServer(server *genericapiserver.GenericAPIServer) {
}

package apiextensions

import (
	"context"
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsopenapi "k8s.io/apiextensions-apiserver/pkg/generated/openapi"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ builder.APIGroupBuilder = (*APIExtensionsBuilder)(nil)

// APIExtensionsBuilder implements builder.APIGroupBuilder for CustomResourceDefinitions
type APIExtensionsBuilder struct {
	features       featuremgmt.FeatureToggles
	storage        *genericregistry.Store
	accessClient   authlib.AccessClient
	dynamicReg     *DynamicRegistry
	restOptGetter  *apistore.RESTOptionsGetter
	apiregistrar   builder.APIRegistrar
	unifiedClient  resource.ResourceClient
	preloadedCRDs  []*apiextensionsv1.CustomResourceDefinition // CRDs loaded before init
	dynamicHandler *DynamicCRHandler                           // Dynamic handler for custom resources
	server         *genericapiserver.GenericAPIServer          // The running API server
}

// SetAPIServer sets the API server instance
// This allows the builder to register dynamic API groups (CRDs)
func (b *APIExtensionsBuilder) SetAPIServer(server *genericapiserver.GenericAPIServer) {
	b.server = server
	if b.dynamicReg != nil {
		b.dynamicReg.SetAPIServer(server)
	}

	// Register a PostStartHook to register OpenAPI specs after the server is fully prepared
	// This is necessary because OpenAPIV3VersionedService is only available after PrepareRun()
	server.AddPostStartHookOrDie("apiextensions-openapi", func(context genericapiserver.PostStartHookContext) error {
		if b.dynamicReg != nil {
			return b.dynamicReg.RegisterOpenAPIForExistingCRDs()
		}
		return nil
	})
}

// RegisterAPIService registers the apiextensions API group in single-tenant mode
func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	accessClient authlib.AccessClient,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
) (*APIExtensionsBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagApiExtensions) {
		return nil, nil
	}

	b := &APIExtensionsBuilder{
		features:      features,
		accessClient:  accessClient,
		apiregistrar:  apiregistration,
		unifiedClient: unified,
	}

	// Register the CRD API group
	apiregistration.RegisterAPI(b)

	// NOTE: We can't load CRDs here because unified storage isn't fully initialized yet
	// We'll use a PostStartHook instead to load CRDs after the server is running
	// See the postStartHook field and RegisterPostStartHooks method below

	return b, nil
}

// The default authorizer is fine because authorization happens in storage where we know the parent folder
func (b *APIExtensionsBuilder) GetAuthorizer() authorizer.Authorizer {
	return grafanaauthorizer.NewServiceAuthorizer()
}

// loadAndRegisterCRDsWithDynamicHandler loads CRDs from storage and registers their handlers
// This is called during UpdateAPIGroupInfo when storage IS ready
func (b *APIExtensionsBuilder) loadAndRegisterCRDsWithDynamicHandler(
	ctx context.Context,
	crdStore *genericregistry.Store,
	opts builder.APIGroupOptions,
) error {
	// TODO(@konsalex): Have a conditional check here for MT
	// For ST we can use the identity.WithServiceIdentityContext
	// for MT we can use implicitly use a service token:
	// https://github.com/grafana/kube-manifests/blob/9f5e409c72fef4f831b173480131121e9cb348a3/flux/dev-us-east-0/grafana-iam/Deployment-iam-grafana-app-main.yaml#L114C9-L114C59
	// SO we can skip systemCtx creation
	systemCtx := identity.WithServiceIdentityContext(context.WithoutCancel(ctx), 1)

	// List all CRDs using the initialized storage
	listObj, err := crdStore.List(systemCtx, &metainternalversion.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list CRDs: %w", err)
	}

	crdList, ok := listObj.(*apiextensionsv1.CustomResourceDefinitionList)
	if !ok {
		return fmt.Errorf("unexpected list type: %T", listObj)
	}

	if len(crdList.Items) == 0 {
		fmt.Println("No existing CRDs found in storage")
		return nil
	}

	fmt.Printf("Found %d CRDs in storage, registering with dynamic handler...\n", len(crdList.Items))

	// For each CRD, create storage and register it with the dynamic handler
	for i := range crdList.Items {
		crd := &crdList.Items[i]

		fmt.Printf("  - Processing CRD: %s (group: %s, version: %s, resource: %s)\n",
			crd.Name, crd.Spec.Group, crd.Spec.Versions[0].Name, crd.Spec.Names.Plural)

		// Support only single version for now
		if len(crd.Spec.Versions) != 1 {
			fmt.Printf("    Warning: only single-version CRDs supported, skipping %s\n", crd.Name)
			continue
		}

		version := crd.Spec.Versions[0]

		// Create storage for this custom resource
		crStorage, err := NewCustomResourceStorage(
			crd,
			version.Name,
			opts.Scheme,
			opts.OptsGetter,
			b.accessClient,
			b.unifiedClient,
		)
		if err != nil {
			fmt.Printf("    Warning: failed to create storage for CRD %s: %v\n", crd.Name, err)
			continue
		}

		// Register with the dynamic handler (for HTTP routing)
		b.dynamicHandler.RegisterCustomResource(crd, version.Name, crStorage)

		// Register with the dynamic registry (for API discovery)
		fmt.Printf("    DEBUG: Registering CRD with dynamic registry (b.dynamicReg=%v)...\n", b.dynamicReg != nil)
		if err := b.dynamicReg.RegisterCRD(crd); err != nil {
			fmt.Printf("    Warning: failed to register CRD with dynamic registry: %v\n", err)
		} else {
			fmt.Printf("    ✓ Registered CRD with dynamic registry\n")
		}

		fmt.Printf("    ✓ Registered with dynamic handler: %s/%s/%s\n",
			crd.Spec.Group, version.Name, crd.Spec.Names.Plural)
	}

	return nil
}

// NewAPIService creates an APIExtensionsBuilder for multi-tenant mode
// TODO(@konsalex): NOT YET IMPLEMENTED properly
func NewAPIService(
	accessClient authlib.AccessClient,
	unified resource.ResourceClient,
	registerer prometheus.Registerer,
	features featuremgmt.FeatureToggles,
) (*APIExtensionsBuilder, error) {
	return &APIExtensionsBuilder{
		features:     features,
		accessClient: accessClient,
	}, nil
}

func (b *APIExtensionsBuilder) GetGroupVersion() schema.GroupVersion {
	return apiextensionsv1.SchemeGroupVersion
}

func (b *APIExtensionsBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()

	// We don't register CRD types with AddKnownTypes here because:
	// 1. The external k8s.io/apiextensions-apiserver types don't have openapi-gen annotations
	// 2. This would cause the API server to try to generate OpenAPI specs for them
	// 3. We register them at the storage level in UpdateAPIGroupInfo instead

	// We only need to add the metav1 types to this group version
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIExtensionsBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

// GetDynamicHandler returns the dynamic custom resource handler
// This can be used to install it as a fallback handler in the HTTP server
func (b *APIExtensionsBuilder) GetDynamicHandler() http.Handler {
	if b.dynamicHandler == nil {
		return nil
	}
	return b.dynamicHandler
}

func (b *APIExtensionsBuilder) UpdateAPIGroupInfo(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
) error {
	// Register storage options for CRDs
	opts.StorageOptsRegister(
		schema.GroupResource{Group: apiextensionsv1.GroupName, Resource: "customresourcedefinitions"},
		apistore.StorageOptions{},
	)

	// Register the CRD types directly with the scheme now (at storage registration time)
	// This avoids OpenAPI generation issues during schema installation
	gv := b.GetGroupVersion()
	opts.Scheme.AddKnownTypes(gv,
		&apiextensionsv1.CustomResourceDefinition{},
		&apiextensionsv1.CustomResourceDefinitionList{},
	)

	// Create the main CRD storage
	crdResourceInfo := utils.NewResourceInfo(
		apiextensionsv1.GroupName,
		"v1",
		"customresourcedefinitions",
		"customresourcedefinition",
		"CustomResourceDefinition",
		func() runtime.Object { return &apiextensionsv1.CustomResourceDefinition{} },
		func() runtime.Object { return &apiextensionsv1.CustomResourceDefinitionList{} },
		utils.TableColumns{},
	)
	crdResourceInfoWithScope := crdResourceInfo.WithClusterScope()

	unified, err := grafanaregistry.NewRegistryStore(
		opts.Scheme,
		crdResourceInfoWithScope,
		opts.OptsGetter,
	)
	if err != nil {
		return fmt.Errorf("failed to create CRD storage: %w", err)
	}

	b.storage = unified
	b.restOptGetter = opts.OptsGetter.(*apistore.RESTOptionsGetter)

	// Initialize dynamic registry for custom resources
	b.dynamicReg = NewDynamicRegistry(
		opts.Scheme,
		opts.OptsGetter,
		apiGroupInfo,
		b.accessClient,
	)
	if b.server != nil {
		b.dynamicReg.SetAPIServer(b.server)
	}

	// Create the dynamic handler for custom resources
	b.dynamicHandler = NewDynamicCRHandler(opts.Scheme)

	// NOW storage is ready, load CRDs and register their handlers dynamically
	if err := b.loadAndRegisterCRDsWithDynamicHandler(context.Background(), unified, opts); err != nil {
		// TODO(@konsalex): use logger here
		fmt.Printf("failed to load and register CRDs: %v\n", err)
		// Don't fail - CRDs can be created later
	}

	// Start watching CRDs for changes (WIP)
	go b.dynamicReg.Start(context.Background(), unified)

	storage := map[string]rest.Storage{}
	storage["customresourcedefinitions"] = &crdStorage{
		Store:      unified,
		dynamicReg: b.dynamicReg,
	}
	storage["customresourcedefinitions/status"] = &crdStatusStorage{Store: unified}

	apiGroupInfo.VersionedResourcesStorageMap[apiextensionsv1.SchemeGroupVersion.Version] = storage

	return nil
}

func (b *APIExtensionsBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return apiextensionsopenapi.GetOpenAPIDefinitions(ref)
	}
}

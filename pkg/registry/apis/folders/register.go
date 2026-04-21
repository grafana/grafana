package folders

import (
	"context"
	"fmt"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/dynamic"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	sdkres "github.com/grafana/grafana-app-sdk/resource"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldersv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/fieldselectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ builder.APIGroupBuilder = (*FolderAPIBuilder)(nil)
var _ builder.APIGroupValidation = (*FolderAPIBuilder)(nil)

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	storage              grafanarest.Storage
	permissionStore      PermissionStore
	accessClient         authlib.AccessClient
	parents              parentsGetter
	searcher             resourcepb.ResourceIndexClient
	maxNestedFolderDepth int

	useZanzana          bool // features.IsEnabledGlobally(featuremgmt.FlagZanzana)
	permissionsOnCreate bool // cfg.RBAC.PermissionsOnCreation("folder")

	// Legacy services -- these will not exist in the MT environment
	resourcePermissionsSvc *dynamic.NamespaceableResourceInterface
	folderPermissionsSvc   accesscontrol.FolderPermissionsService // TODO: Remove this once kubernetesAuthzResourcePermissionApis is removed and the frontend is calling /apis directly to create root level folders
	acService              accesscontrol.Service
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	folderPermissionsSvc accesscontrol.FolderPermissionsService,
	accessControl accesscontrol.AccessControl,
	acService accesscontrol.Service,
	accessClient authlib.AccessClient,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
	zanzanaClient zanzana.Client,
) *FolderAPIBuilder {
	builder := &FolderAPIBuilder{
		folderPermissionsSvc: folderPermissionsSvc,
		acService:            acService,
		accessClient:         accessClient,
		permissionsOnCreate:  cfg.RBAC.PermissionsOnCreation("folder"),
		useZanzana:           features.IsEnabledGlobally(featuremgmt.FlagZanzana), //nolint:staticcheck
		searcher:             unified,
		permissionStore:      NewZanzanaPermissionStore(zanzanaClient),
		maxNestedFolderDepth: cfg.MaxNestedFolderDepth,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient, searcher resource.ResourceClient, features featuremgmt.FeatureToggles, zanzanaClient zanzana.Client, resourcePermissionsSvc *dynamic.NamespaceableResourceInterface, maxNestedFolderDepth int) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		useZanzana:             features.IsEnabledGlobally(featuremgmt.FlagZanzana), //nolint:staticcheck
		accessClient:           ac,
		searcher:               searcher,
		permissionStore:        NewZanzanaPermissionStore(zanzanaClient),
		resourcePermissionsSvc: resourcePermissionsSvc,
		maxNestedFolderDepth:   maxNestedFolderDepth,
	}
}

func (b *FolderAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	// Same pattern as dashboards: stable version first, then compatibility alias.
	// This order feeds LegacyCodec(groupVersions...) and must match SetVersionPriority below.
	return []schema.GroupVersion{
		foldersv1.FolderResourceInfo.GroupVersion(),
		foldersv1beta1.FolderResourceInfo.GroupVersion(),
	}
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion, types ...runtime.Object) {
	scheme.AddKnownTypes(gv, types...)
}

func (b *FolderAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gvv1beta1 := foldersv1beta1.FolderResourceInfo.GroupVersion()
	gvv1 := foldersv1.FolderResourceInfo.GroupVersion()

	addKnownTypes(scheme, gvv1,
		&foldersv1.Folder{},
		&foldersv1.FolderList{},
		&foldersv1.FolderInfoList{},
		&foldersv1.DescendantCounts{},
		&foldersv1.FolderAccessInfo{},
	)

	addKnownTypes(scheme, gvv1beta1,
		&foldersv1beta1.Folder{},
		&foldersv1beta1.FolderList{},
		&foldersv1beta1.FolderInfoList{},
		&foldersv1beta1.DescendantCounts{},
		&foldersv1beta1.FolderAccessInfo{},
	)
	// Link v1beta1 to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   foldersv1.FolderResourceInfo.GroupVersion().Group,
		Version: runtime.APIVersionInternal,
	},
		&foldersv1.Folder{},
		&foldersv1.FolderList{},
		&foldersv1.FolderInfoList{},
		&foldersv1.DescendantCounts{},
		&foldersv1.FolderAccessInfo{},
	)

	metav1.AddToGroupVersion(scheme, gvv1)
	metav1.AddToGroupVersion(scheme, gvv1beta1)
	err := fieldselectors.AddSelectableFieldLabelConversions(scheme, gvv1, foldersv1.FolderKind())
	if err != nil {
		return err
	}
	err = fieldselectors.AddSelectableFieldLabelConversions(scheme, gvv1beta1, foldersv1beta1.FolderKind())
	if err != nil {
		return err
	}
	return scheme.SetVersionPriority(b.GetGroupVersions()...)
}

func (b *FolderAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *FolderAPIBuilder) storageForVersion(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	folders utils.ResourceInfo,
	folderKind sdkres.Kind,
) error {
	selectableFieldsOpts := grafanaregistry.SelectableFieldsOptions{
		GetAttrs: fieldselectors.BuildGetAttrsFn(folderKind),
	}
	unified, err := grafanaregistry.NewRegistryStoreWithSelectableFields(opts.Scheme, folders, opts.OptsGetter, selectableFieldsOpts)
	if err != nil {
		return err
	}
	b.registerPermissionHooks(unified)
	b.storage = unified

	// This is the ST wrapper
	if b.folderPermissionsSvc != nil {
		b.storage = &folderStorage{
			resourceInfo:         folders,
			tableConverter:       folders.TableConverter(),
			folderPermissionsSvc: b.folderPermissionsSvc,
			acService:            b.acService,
			permissionsOnCreate:  b.permissionsOnCreate,
			store:                unified,
		}
	}

	storage := map[string]rest.Storage{}
	storage[folders.StoragePath()] = b.storage

	b.parents = newParentsGetter(b.storage, b.maxNestedFolderDepth) // used for validation
	storage[folders.StoragePath("parents")] = &subParentsREST{
		getter:  b.storage,
		parents: b.parents,
	}
	storage[folders.StoragePath("counts")] = &subCountREST{
		getter:   b.storage,
		searcher: b.searcher,
	}
	storage[folders.StoragePath("access")] = &subAccessREST{
		getter:       b.storage,
		accessClient: b.accessClient,
	}

	// Adds a path to return children of a given folder
	storage[folders.StoragePath("children")] = &subChildrenREST{
		getter: b.storage,
		lister: b.storage,
	}

	apiGroupInfo.VersionedResourcesStorageMap[folders.GroupVersion().Version] = storage
	return nil
}

func (b *FolderAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	opts.StorageOptsRegister(foldersv1.FolderResourceInfo.GroupResource(), apistore.StorageOptions{
		// Preserve apiVersion/kind from the client on write. Without Scheme, apistore.encode
		// uses the global LegacyCodec and converts to a single preferred external version.
		Scheme:                      opts.Scheme,
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
		Permissions:                 b.setDefaultFolderPermissions,
	})

	// v1
	if err := b.storageForVersion(
		apiGroupInfo,
		opts,
		foldersv1.FolderResourceInfo,
		foldersv1.FolderKind(),
	); err != nil {
		return err
	}

	// v1beta1
	if err := b.storageForVersion(
		apiGroupInfo,
		opts,
		foldersv1beta1.FolderResourceInfo,
		foldersv1beta1.FolderKind(),
	); err != nil {
		return err
	}

	return nil
}

var defaultPermissions = []map[string]any{
	{
		"kind": "BasicRole",
		"name": "Editor",
		"verb": "edit",
	},
	{
		"kind": "BasicRole",
		"name": "Viewer",
		"verb": "view",
	},
}

func (b *FolderAPIBuilder) setDefaultFolderPermissions(ctx context.Context, key *resourcepb.ResourceKey, id authlib.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	if b.resourcePermissionsSvc == nil {
		return nil
	}

	// only set default permissions for root folders
	if obj.GetFolder() != "" {
		return nil
	}

	log := logging.FromContext(ctx)
	log.Debug("setting default folder permissions", "uid", obj.GetName(), "namespace", obj.GetNamespace())

	client := (*b.resourcePermissionsSvc).Namespace(obj.GetNamespace())
	name := fmt.Sprintf("%s-%s-%s", foldersv1.FolderResourceInfo.GroupVersionResource().Group, foldersv1.FolderResourceInfo.GroupVersionResource().Resource, obj.GetName())

	// the resource permission will likely already exist with admin can admin, so we will need to update it
	if _, err := client.Get(ctx, name, metav1.GetOptions{}); err == nil {
		_, err := client.Update(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      name,
					"namespace": obj.GetNamespace(),
				},
				"spec": map[string]any{
					"resource": map[string]any{
						"apiGroup": foldersv1.FolderResourceInfo.GroupVersionResource().Group,
						"resource": foldersv1.FolderResourceInfo.GroupVersionResource().Resource,
						"name":     obj.GetName(),
					},
					"permissions": defaultPermissions,
				},
			},
		}, metav1.UpdateOptions{})
		if err != nil {
			logger.Error("failed to update root permissions", "error", err)
			return fmt.Errorf("update root permissions: %w", err)
		}

		return nil
	}

	_, err := client.Create(ctx, &unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]any{
				"name":      name,
				"namespace": obj.GetNamespace(),
			},
			"spec": map[string]any{
				"resource": map[string]any{
					"apiGroup": foldersv1.FolderResourceInfo.GroupVersionResource().Group,
					"resource": foldersv1.FolderResourceInfo.GroupVersionResource().Resource,
					"name":     obj.GetName(),
				},
				"permissions": defaultPermissions,
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		logger.Error("failed to create root permissions", "error", err)
		return fmt.Errorf("create root permissions: %w", err)
	}

	return nil
}

func (b *FolderAPIBuilder) registerPermissionHooks(store *genericregistry.Store) {
	log := logging.FromContext(context.Background())
	if b.useZanzana {
		log.Info("Enabling Zanzana folder propagation hooks")
		store.BeginCreate = b.beginCreate
		store.BeginUpdate = b.beginUpdate
	} else {
		log.Info("Zanzana is not enabled; skipping folder propagation hooks")
	}

	store.AfterDelete = b.afterDelete
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	// Same pattern as dashboards: v1beta1 aliases v1; kube-openapi definitions use v1 model keys only.
	return foldersv1.GetOpenAPIDefinitions
}

func (b *FolderAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana folders"
	return oas, nil
}

// The default authorizer is fine because authorization happens in storage where we know the parent folder
func (b *FolderAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return grafanaauthorizer.NewServiceAuthorizer()
}

func (b *FolderAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	verb := a.GetOperation()
	if verb == admission.Create || verb == admission.Update {
		obj := a.GetObject()
		f, ok := obj.(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		f.Spec.Title = strings.Trim(f.Spec.Title, " ")
		return nil
	}
	return nil
}

func (b *FolderAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	var obj runtime.Object
	verb := a.GetOperation()

	switch verb {
	case admission.Create, admission.Update:
		obj = a.GetObject()
	case admission.Delete:
		obj = a.GetOldObject()
		if obj == nil {
			return fmt.Errorf("old object is nil for delete request")
		}
	case admission.Connect:
		return nil
	default:
		obj = a.GetObject()
	}

	f, ok := obj.(*foldersv1.Folder)
	if !ok {
		return fmt.Errorf("obj is not folders.Folder")
	}

	switch a.GetOperation() {
	case admission.Create:
		if err := validateOwnerReferencesOnManagedFolder(f, nil); err != nil {
			return err
		}
		return validateOnCreate(ctx, f, b.parents, b.maxNestedFolderDepth)
	case admission.Delete:
		return validateOnDelete(ctx, f, b.searcher)
	case admission.Update:
		old, ok := a.GetOldObject().(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		if err := validateOwnerReferencesOnManagedFolder(f, old); err != nil {
			return err
		}
		return validateOnUpdate(ctx, f, old, b.storage, b.parents, b.searcher, b.maxNestedFolderDepth)
	default:
		return nil
	}
}

package folders

import (
	"context"
	"fmt"
	"strings"
	"sync"

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
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/fieldselectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ builder.APIGroupBuilder    = (*FolderAPIBuilder)(nil)
	_ builder.APIGroupValidation = (*FolderAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	storage              grafanarest.Storage
	permissionStore      PermissionStore
	accessClient         authlib.AccessClient
	parents              parentsGetter
	searcher             resourcepb.ResourceIndexClient
	maxNestedFolderDepth int

	// Flags
	useZanzana          bool // features.IsEnabledGlobally(featuremgmt.FlagZanzana)
	permissionsOnCreate bool // cfg.RBAC.PermissionsOnCreation("folder")

	// cascadeDeleteEnabled is the kubernetesFolderCascadeDelete flag captured once at boot in
	// storageForVersion. Admission (Mutate/Validate) reads this instead of re-evaluating the flag
	// per request, so the cascade finalizer is only ever stamped when the finalizer storage wrapper
	// and the cascade watcher -- both boot-time, process-global decisions -- are also active.
	// Re-evaluating per request would let a runtime or per-tenant flag flip stamp a finalizer that
	// nothing ever removes, leaving the folder stuck terminating.
	cascadeDeleteEnabled bool

	// forceDeleteEnabled gates honoring gracePeriodSeconds=0 to bypass the empty-folder check on
	// delete. It is true when kubernetesFolderForceDelete is on, or implied by cascadeDeleteEnabled
	// (a non-empty folder can only be cascaded by first bypassing the empty check). Captured at boot
	// alongside cascadeDeleteEnabled.
	forceDeleteEnabled bool

	// Legacy services -- these will not exist in the MT environment
	resourcePermissionsSvc *dynamic.NamespaceableResourceInterface
	// Do not access directly: use `resourcePermissionsClient(ctx)`. In embedded mode this is
	// built lazily from restConfigProvider and is nil until the first call.
	folderPermissionsSvc accesscontrol.FolderPermissionsService // TODO: Remove this once kubernetesAuthzResourcePermissionApis is removed and the frontend is calling /apis directly to create root level folders

	// Embedded mode builds resourcePermissionsSvc lazily from restConfigProvider; MT injects
	// resourcePermissionsSvc directly and leaves restConfigProvider nil.
	restConfigProvider       apiserver.RestConfigProvider
	resourcePermissionsSvcMu sync.Mutex
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	folderPermissionsSvc accesscontrol.FolderPermissionsService,
	accessClient authlib.AccessClient,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
	zanzanaClient zanzana.Client,
	restConfigProvider apiserver.RestConfigProvider,
) *FolderAPIBuilder {
	builder := &FolderAPIBuilder{
		accessClient:         accessClient,
		permissionsOnCreate:  cfg.RBAC.PermissionsOnCreation("folder"),
		useZanzana:           features.IsEnabledGlobally(featuremgmt.FlagZanzana), //nolint:staticcheck
		searcher:             unified,
		permissionStore:      NewZanzanaPermissionStore(zanzanaClient),
		maxNestedFolderDepth: cfg.MaxNestedFolderDepth,
	}

	// With the flag on, use the App Platform permission path and leave the legacy folderPermissionsSvc
	// unwired (so its folderStorage wrapper isn't installed); otherwise keep the legacy path.
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis) { //nolint:staticcheck
		builder.restConfigProvider = restConfigProvider
	} else {
		builder.folderPermissionsSvc = folderPermissionsSvc
	}

	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient, searcher resource.ResourceClient, features featuremgmt.FeatureToggles, zanzanaClient zanzana.Client, resourcePermissionsSvc *dynamic.NamespaceableResourceInterface, maxNestedFolderDepth int) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		accessClient:           ac,
		searcher:               searcher,
		permissionStore:        NewZanzanaPermissionStore(zanzanaClient),
		resourcePermissionsSvc: resourcePermissionsSvc,
		maxNestedFolderDepth:   maxNestedFolderDepth,
		useZanzana:             features.IsEnabledGlobally(featuremgmt.FlagZanzana), //nolint:staticcheck
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
	b.cascadeDeleteEnabled = kubernetesFolderCascadeDeleteEnabled(context.Background())
	// Cascade implies force: a non-empty folder can only be cascaded by bypassing the empty check.
	b.forceDeleteEnabled = b.cascadeDeleteEnabled || kubernetesFolderForceDeleteEnabled(context.Background())
	// Always wrap in finalizerStorage, even when cascade is disabled: folders created while it was
	// enabled carry the finalizer durably, and the wrapper is what strips it so they can still be
	// deleted. The wrapper gates cascade behavior on cascadeDeleteEnabled internally.
	st := newFinalizerStorage(unified, b.searcher, b.cascadeDeleteEnabled)
	b.storage = st

	// This is the ST wrapper
	if b.folderPermissionsSvc != nil {
		b.storage = &folderStorage{
			resourceInfo:         folders,
			tableConverter:       folders.TableConverter(),
			folderPermissionsSvc: b.folderPermissionsSvc,
			permissionsOnCreate:  b.permissionsOnCreate,
			store:                st,
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
		getter:   b.storage,
		searcher: b.searcher,
	}

	apiGroupInfo.VersionedResourcesStorageMap[folders.GroupVersion().Version] = storage
	return nil
}

func (b *FolderAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	opts.StorageOptsRegister(foldersv1.FolderResourceInfo.GroupResource(), apistore.StorageOptions{
		// Preserve apiVersion/kind from the client on write. Without Scheme, apistore.encode
		// uses the global LegacyCodec and converts to a single preferred external version.
		Scheme:               opts.Scheme,
		Index:                b.searcher,
		EnableFolderSupport:  true,
		DeprecatedInternalID: apistore.DeprecatedID_Required,
		Permissions:          b.setDefaultFolderPermissions,
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

// buildDefaultFolderPermissions returns the default folder permissions with the creator granted
// admin (in addition to the default basic-role permissions). Non-user/service-account identities
// (anonymous, render service, etc.) get only the default permission set.
func buildDefaultFolderPermissions(id authlib.AuthInfo) []map[string]any {
	var creatorKind string
	switch id.GetIdentityType() {
	case authlib.TypeUser:
		creatorKind = string(iamv0alpha1.ResourcePermissionSpecPermissionKindUser)
	case authlib.TypeServiceAccount:
		creatorKind = string(iamv0alpha1.ResourcePermissionSpecPermissionKindServiceAccount)
	default:
		// Non-user/service-account identities (anonymous, render service, etc.) get only the
		// default permission set; no creator admin grant.
	}

	if creatorKind == "" {
		return defaultPermissions
	}

	permissions := make([]map[string]any, 0, len(defaultPermissions)+1)
	permissions = append(permissions, map[string]any{
		"kind": creatorKind,
		"name": id.GetIdentifier(),
		"verb": "admin",
	})
	return append(permissions, defaultPermissions...)
}

// resourcePermissionsClient returns the ResourcePermission dynamic client, building it lazily from
// restConfigProvider in embedded mode. Returns nil when no client is configured (e.g. flag off).
func (b *FolderAPIBuilder) resourcePermissionsClient(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	// MT: injected directly, never mutated, restConfigProvider nil.
	if b.restConfigProvider == nil {
		return b.resourcePermissionsSvc, nil
	}

	// Embedded: build lazily (loopback config isn't ready at registration). The mutex avoids a
	// data race; failures aren't cached so a transient error doesn't poison later creates.
	b.resourcePermissionsSvcMu.Lock()
	defer b.resourcePermissionsSvcMu.Unlock()

	if b.resourcePermissionsSvc != nil {
		return b.resourcePermissionsSvc, nil
	}

	cfg, err := b.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rest config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}
	client := dyn.Resource(iamv0alpha1.ResourcePermissionInfo.GroupVersionResource())
	b.resourcePermissionsSvc = &client
	return b.resourcePermissionsSvc, nil
}

func (b *FolderAPIBuilder) setDefaultFolderPermissions(ctx context.Context, key *resourcepb.ResourceKey, id authlib.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	resourcePermissionsSvc, err := b.resourcePermissionsClient(ctx)
	if err != nil {
		return err
	}
	if resourcePermissionsSvc == nil {
		return nil
	}

	// only set default permissions for root folders
	if !folder.IsRootFolderUID(obj.GetFolder()) {
		return nil
	}

	log := logging.FromContext(ctx)
	log.Debug("setting default folder permissions", "uid", obj.GetName(), "namespace", obj.GetNamespace())

	// Setting the default permissions is a system operation triggered by the creation of the
	// folder, not an action the requester performs directly. The creator does not yet have
	// permission to manage permissions on the brand-new folder, so we use a service identity to
	// write them through the ResourcePermission API.
	nsInfo, err := authlib.ParseNamespace(obj.GetNamespace())
	if err != nil {
		return fmt.Errorf("parse namespace: %w", err)
	}
	ctx = identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)

	// The creator gets admin on their folder, in addition to the default basic-role permissions.
	// Anonymous and other non-user identities don't get an explicit grant.
	permissions := buildDefaultFolderPermissions(id)

	client := (*resourcePermissionsSvc).Namespace(obj.GetNamespace())
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
					"permissions": permissions,
				},
			},
		}, metav1.UpdateOptions{})
		if err != nil {
			logger.Error("failed to update root permissions", "error", err)
			return fmt.Errorf("update root permissions: %w", err)
		}

		return nil
	}

	_, err = client.Create(ctx, &unstructured.Unstructured{
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
				"permissions": permissions,
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

func (b *FolderAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, oi admission.ObjectInterfaces) error {
	switch a.GetOperation() {
	case admission.Create, admission.Update:
		obj := a.GetObject()
		if obj == nil {
			return nil
		}
		f, ok := obj.(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		if b.cascadeDeleteEnabled {
			ensureCascadeFinalizerOnObject(f)
		}
		f.Spec.Title = strings.Trim(f.Spec.Title, " ")
		return nil
	case admission.Delete:
		return nil
	default:
		return nil
	}
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
		if err := validateTerminatingLabelUnchanged(ctx, f, nil); err != nil {
			return err
		}
		return validateOnCreate(ctx, f, b.storage, b.parents, b.maxNestedFolderDepth)
	case admission.Delete:
		deleteOptions, _ := a.GetOperationOptions().(*metav1.DeleteOptions)
		return validateOnDelete(ctx, f, b.searcher, deleteOptions, b.forceDeleteEnabled, b.cascadeDeleteEnabled)
	case admission.Update:
		old, ok := a.GetOldObject().(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		if err := validateOwnerReferencesOnManagedFolder(f, old); err != nil {
			return err
		}
		if err := validateTerminatingLabelUnchanged(ctx, f, old); err != nil {
			return err
		}
		return validateOnUpdate(ctx, f, old, b.storage, b.parents, b.searcher, b.accessClient, b.maxNestedFolderDepth)
	default:
		return nil
	}
}

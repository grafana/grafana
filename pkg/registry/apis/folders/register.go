package folders

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

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
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	sdkres "github.com/grafana/grafana-app-sdk/resource"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
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
	_ builder.APIGroupBuilder               = (*FolderAPIBuilder)(nil)
	_ builder.APIGroupValidation            = (*FolderAPIBuilder)(nil)
	_ builder.APIGroupPostStartHookProvider = (*FolderAPIBuilder)(nil)
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

	// Legacy services -- these will not exist in the MT environment
	resourcePermissionsSvc *dynamic.NamespaceableResourceInterface
	// Do not access directly: use `resourcePermissionsClient(ctx)`. In embedded mode this is
	// built lazily from restConfigProvider and is nil until the first call.
	folderPermissionsSvc accesscontrol.FolderPermissionsService // TODO: Remove this once kubernetesAuthzResourcePermissionApis is removed and the frontend is calling /apis directly to create root level folders

	// Embedded mode builds resourcePermissionsSvc lazily from restConfigProvider; MT injects
	// resourcePermissionsSvc directly and leaves restConfigProvider nil.
	restConfigProvider       apiserver.RestConfigProvider
	resourcePermissionsSvcMu sync.Mutex

	// Dashboard client for cascade delete, built lazily from cascadeConfigProvider; access via
	// dashboardClient(ctx). Set independently of the authz flag so cleanup works whenever cascade is on.
	cascadeConfigProvider apiserver.RestConfigProvider
	dashboardSvc          *dynamic.NamespaceableResourceInterface
	dashboardSvcMu        sync.Mutex
	variableSvc           *dynamic.NamespaceableResourceInterface
	variableSvcMu         sync.Mutex
	// contentsDeleter removes alert rules and library elements contained in a folder during cascade
	// delete. Nil in MT (NewAPIService), where that cleanup is handled elsewhere.
	contentsDeleter FolderContentsDeleter
}

// dashboardClient builds the dashboard dynamic client lazily. Returns nil when no config provider is
// set, in which case cascade delete skips dashboard cleanup.
func (b *FolderAPIBuilder) dashboardClient(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	if b.cascadeConfigProvider == nil {
		return b.dashboardSvc, nil
	}

	b.dashboardSvcMu.Lock()
	defer b.dashboardSvcMu.Unlock()

	if b.dashboardSvc != nil {
		return b.dashboardSvc, nil
	}

	cfg, err := b.cascadeConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rest config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}
	client := dyn.Resource(dashv1.DashboardResourceInfo.GroupVersionResource())
	b.dashboardSvc = &client
	return b.dashboardSvc, nil
}

func (b *FolderAPIBuilder) variableClient(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	if b.cascadeConfigProvider == nil {
		return b.variableSvc, nil
	}

	b.variableSvcMu.Lock()
	defer b.variableSvcMu.Unlock()

	if b.variableSvc != nil {
		return b.variableSvc, nil
	}

	cfg, err := b.cascadeConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rest config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}
	client := dyn.Resource(dashV2beta1.VariableResourceInfo.GroupVersionResource())
	b.variableSvc = &client
	return b.variableSvc, nil
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
	contentsDeleter FolderContentsDeleter,
) *FolderAPIBuilder {
	builder := &FolderAPIBuilder{
		accessClient:         accessClient,
		permissionsOnCreate:  cfg.RBAC.PermissionsOnCreation("folder"),
		useZanzana:           features.IsEnabledGlobally(featuremgmt.FlagZanzana), //nolint:staticcheck
		searcher:             unified,
		permissionStore:      NewZanzanaPermissionStore(zanzanaClient),
		maxNestedFolderDepth: cfg.MaxNestedFolderDepth,
		contentsDeleter:      contentsDeleter,
	}

	// With the flag on, use the App Platform permission path and leave the legacy folderPermissionsSvc
	// unwired (so its folderStorage wrapper isn't installed); otherwise keep the legacy path.
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis) { //nolint:staticcheck
		builder.restConfigProvider = restConfigProvider
	} else {
		builder.folderPermissionsSvc = folderPermissionsSvc
	}

	// Cascade dashboard cleanup needs an apiserver client regardless of the authz flag above.
	builder.cascadeConfigProvider = restConfigProvider

	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient, searcher resource.ResourceClient, features featuremgmt.FeatureToggles, zanzanaClient zanzana.Client, resourcePermissionsSvc *dynamic.NamespaceableResourceInterface, dashboardSvc *dynamic.NamespaceableResourceInterface, variableSvc *dynamic.NamespaceableResourceInterface, maxNestedFolderDepth int) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		accessClient:           ac,
		searcher:               searcher,
		permissionStore:        NewZanzanaPermissionStore(zanzanaClient),
		resourcePermissionsSvc: resourcePermissionsSvc,
		dashboardSvc:           dashboardSvc, // injected so cascade delete can remove dashboards in MT
		variableSvc:            variableSvc,  // injected so cascade delete can remove variables in MT
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
	b.storage = unified

	// Status subresource for the PoC async cascade delete controller (see
	// cascade_delete_controller.go), which writes progress here rather than to the main object.
	// Wired against the unwrapped store (before the cascade-delete Delete() wrapper below) since
	// status updates don't need cascade-on-delete behavior.
	statusStore := grafanaregistry.NewRegistryStatusStore(opts.Scheme, unified)

	// This is the ST wrapper
	if b.folderPermissionsSvc != nil {
		b.storage = &folderStorage{
			resourceInfo:         folders,
			tableConverter:       folders.TableConverter(),
			folderPermissionsSvc: b.folderPermissionsSvc,
			permissionsOnCreate:  b.permissionsOnCreate,
			store:                unified,
		}
	}

	// Cascade delete wrapper -- always wired (both ST and MT). Recursively deletes a folder's
	// subtree on delete; a no-op delegate unless kubernetesFolderCascadeDelete is enabled.
	b.storage = newCascadeDeleteStorage(b.storage, b.searcher, b.dashboardClient, b.variableClient, b.contentsDeleter, b.accessClient)

	storage := map[string]rest.Storage{}
	storage[folders.StoragePath()] = b.storage
	storage[folders.StoragePath("status")] = statusStore

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

// cascadeDeleteControllerResync is the informer's periodic full re-list, acting as a backstop that
// catches anything the live watch missed (e.g. an event delivered while the controller was down).
const cascadeDeleteControllerResync = 5 * time.Minute

// cascadeDeleteControllerWorkers is deliberately small: this is a PoC, not a tuned production
// controller, and folder deletes are not a high-QPS path.
const cascadeDeleteControllerWorkers = 2

// cascadeDeleteControllerHookName identifies the post-start hook below; must be unique among all
// apiserver post-start hooks.
const cascadeDeleteControllerHookName = "grafana-folder-cascade-delete-controller"

// GetPostStartHooks starts the PoC async cascade delete controller once the apiserver is up,
// mirroring how pkg/registry/apis/provisioning starts its repository/connection controllers off a
// post-start hook. This requires no new Wire providers: everything the controller needs
// (b.searcher, b.dashboardClient) is already available on FolderAPIBuilder, and the hook itself is
// picked up automatically by builder.AddPostStartHooks for any builder implementing
// builder.APIGroupPostStartHookProvider.
//
// Known PoC limitation: the feature flag is evaluated once here, at server startup, not
// per-request. Toggling kubernetesFolderCascadeDeleteAsync at runtime (e.g. via GrowthBook) will
// not start or stop the controller without a process restart -- unlike the finalizer-stamping
// admission mutator and the existing synchronous cascade delete, which both check the flag live.
func (b *FolderAPIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	return map[string]genericapiserver.PostStartHookFunc{
		cascadeDeleteControllerHookName: func(hookCtx genericapiserver.PostStartHookContext) error {
			if !kubernetesFolderCascadeDeleteAsyncEnabled(hookCtx.Context) {
				return nil
			}

			dynClient, err := dynamic.NewForConfig(hookCtx.LoopbackClientConfig)
			if err != nil {
				return fmt.Errorf("cascade delete controller: build dynamic client: %w", err)
			}
			gvr := foldersv1.FolderResourceInfo.GroupVersionResource()

			ctrl := NewCascadeDeleteController(dynClient.Resource(gvr), b.dashboardClient, b.searcher)

			factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynClient, cascadeDeleteControllerResync, metav1.NamespaceAll, nil)
			informer := factory.ForResource(gvr).Informer()
			reg, err := informer.AddEventHandler(ctrl.EventHandler())
			if err != nil {
				return fmt.Errorf("cascade delete controller: add event handler: %w", err)
			}
			go informer.Run(hookCtx.Done())

			// Off the hot path: don't block apiserver startup on the informer's initial list.
			go func() {
				if !cache.WaitForCacheSync(hookCtx.Done(), reg.HasSynced) {
					return
				}
				ctrl.Run(hookCtx.Context, cascadeDeleteControllerWorkers, func() {}, func() {})
			}()

			return nil
		},
	}, nil
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

func (b *FolderAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	verb := a.GetOperation()
	if verb == admission.Create || verb == admission.Update {
		obj := a.GetObject()
		f, ok := obj.(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		f.Spec.Title = strings.Trim(f.Spec.Title, " ")
		if verb == admission.Create {
			stampCascadeDeleteFinalizer(ctx, f)
		}
		return nil
	}
	return nil
}

// stampCascadeDeleteFinalizer adds the async cascade-delete finalizer to a newly created folder
// when kubernetesFolderCascadeDeleteAsync is enabled. PoC limitation: this only runs on create, so
// there is no backfill for folders that already existed before the flag was turned on -- those
// folders are unaffected and keep using the existing synchronous cascade delete.
func stampCascadeDeleteFinalizer(ctx context.Context, f *foldersv1.Folder) {
	if !kubernetesFolderCascadeDeleteAsyncEnabled(ctx) {
		return
	}
	if f.DeletionTimestamp != nil && !f.DeletionTimestamp.IsZero() {
		return
	}
	if slices.Contains(f.Finalizers, foldersv1.CascadeDeleteFinalizer) {
		return
	}
	f.Finalizers = append(f.Finalizers, foldersv1.CascadeDeleteFinalizer)
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
		deleteOptions, _ := a.GetOperationOptions().(*metav1.DeleteOptions)
		return validateOnDelete(ctx, f, b.searcher, deleteOptions, kubernetesFolderCascadeDeleteEnabled(ctx))
	case admission.Update:
		old, ok := a.GetOldObject().(*foldersv1.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		if err := validateOwnerReferencesOnManagedFolder(f, old); err != nil {
			return err
		}
		return validateOnUpdate(ctx, f, old, b.storage, b.parents, b.searcher, b.accessClient, b.maxNestedFolderDepth)
	default:
		return nil
	}
}

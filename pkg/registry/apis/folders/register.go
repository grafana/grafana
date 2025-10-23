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

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ builder.APIGroupBuilder = (*FolderAPIBuilder)(nil)
var _ builder.APIGroupValidation = (*FolderAPIBuilder)(nil)

var resourceInfo = folders.FolderResourceInfo

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	features            featuremgmt.FeatureToggles
	namespacer          request.NamespaceMapper
	storage             grafanarest.Storage
	permissionStore     reconcilers.PermissionStore
	accessClient        authlib.AccessClient
	parents             parentsGetter
	searcher            resourcepb.ResourceIndexClient
	permissionsOnCreate bool

	// Legacy services -- these will not exist in the MT environment
	folderSvc              folder.LegacyService
	resourcePermissionsSvc *dynamic.NamespaceableResourceInterface
	folderPermissionsSvc   accesscontrol.FolderPermissionsService // TODO: Remove this once kubernetesAuthzResourcePermissionApis is removed and the frontend is calling /apis directly to create root level folders
	acService              accesscontrol.Service
	ac                     accesscontrol.AccessControl
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	folderSvc folder.LegacyService,
	folderPermissionsSvc accesscontrol.FolderPermissionsService,
	accessControl accesscontrol.AccessControl,
	acService accesscontrol.Service,
	accessClient authlib.AccessClient,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
	zanzanaClient zanzana.Client,
) *FolderAPIBuilder {
	builder := &FolderAPIBuilder{
		features:             features,
		namespacer:           request.GetNamespaceMapper(cfg),
		folderSvc:            folderSvc,
		folderPermissionsSvc: folderPermissionsSvc,
		acService:            acService,
		ac:                   accessControl,
		accessClient:         accessClient,
		permissionsOnCreate:  cfg.RBAC.PermissionsOnCreation("folder"),
		searcher:             unified,
		permissionStore:      reconcilers.NewZanzanaPermissionStore(zanzanaClient),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient, searcher resource.ResourceClient, features featuremgmt.FeatureToggles, zanzanaClient zanzana.Client, resourcePermissionsSvc *dynamic.NamespaceableResourceInterface) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		features:               features,
		accessClient:           ac,
		searcher:               searcher,
		permissionStore:        reconcilers.NewZanzanaPermissionStore(zanzanaClient),
		resourcePermissionsSvc: resourcePermissionsSvc,
	}
}

func (b *FolderAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return resourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&folders.Folder{},
		&folders.FolderList{},
		&folders.FolderInfoList{},
		&folders.DescendantCounts{},
		&folders.FolderAccessInfo{},
	)
}

func (b *FolderAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()
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

func (b *FolderAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *FolderAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	opts.StorageOptsRegister(resourceInfo.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
		Permissions:                 b.setDefaultFolderPermissions,
	})

	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}
	b.registerPermissionHooks(unified)
	b.storage = unified

	if b.folderSvc != nil {
		legacyStore := &legacyStorage{
			service:        b.folderSvc,
			namespacer:     b.namespacer,
			tableConverter: resourceInfo.TableConverter(),
		}
		dw, err := opts.DualWriteBuilder(resourceInfo.GroupResource(), legacyStore, unified)
		if err != nil {
			return err
		}
		b.storage = &folderStorage{
			tableConverter:       resourceInfo.TableConverter(),
			folderPermissionsSvc: b.folderPermissionsSvc,
			features:             b.features,
			acService:            b.acService,
			permissionsOnCreate:  b.permissionsOnCreate,
			store:                dw,
		}
	}

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = b.storage

	b.parents = newParentsGetter(b.storage, folder.MaxNestedFolderDepth) // used for validation
	storage[resourceInfo.StoragePath("parents")] = &subParentsREST{
		getter:  b.storage,
		parents: b.parents,
	}
	storage[resourceInfo.StoragePath("counts")] = &subCountREST{
		getter:   b.storage,
		searcher: b.searcher,
	}
	storage[resourceInfo.StoragePath("access")] = &subAccessREST{
		getter:       b.storage,
		accessClient: b.accessClient,
	}

	// Adds a path to return children of a given folder
	storage[resourceInfo.StoragePath("children")] = &subChildrenREST{
		getter: b.storage,
		lister: b.storage,
	}

	apiGroupInfo.VersionedResourcesStorageMap[folders.VERSION] = storage
	return nil
}

var defaultPermissions = []map[string]any{
	{
		"kind": "BasicRole",
		"name": "Admin",
		"verb": "admin",
	},
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
	name := fmt.Sprintf("%s-%s-%s", folders.FolderResourceInfo.GroupVersionResource().Group, folders.FolderResourceInfo.GroupVersionResource().Resource, obj.GetName())

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
						"apiGroup": folders.FolderResourceInfo.GroupVersionResource().Group,
						"resource": folders.FolderResourceInfo.GroupVersionResource().Resource,
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
					"apiGroup": folders.FolderResourceInfo.GroupVersionResource().Group,
					"resource": folders.FolderResourceInfo.GroupVersionResource().Resource,
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
	//nolint:staticcheck
	if b.features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		log.Info("Enabling Zanzana folder propagation hooks")
		store.BeginCreate = b.beginCreate
		store.BeginUpdate = b.beginUpdate
	} else {
		log.Info("Zanzana is not enabled; skipping folder propagation hooks")
	}

	store.AfterDelete = b.afterDelete
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return folders.GetOpenAPIDefinitions
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
		f, ok := obj.(*folders.Folder)
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

	f, ok := obj.(*folders.Folder)
	if !ok {
		return fmt.Errorf("obj is not folders.Folder")
	}

	switch a.GetOperation() {
	case admission.Create:
		return validateOnCreate(ctx, f, b.parents, folder.MaxNestedFolderDepth)
	case admission.Delete:
		return validateOnDelete(ctx, f, b.searcher)
	case admission.Update:
		old, ok := a.GetOldObject().(*folders.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		return validateOnUpdate(ctx, f, old, b.storage, b.parents, folder.MaxNestedFolderDepth)
	default:
		return nil
	}
}

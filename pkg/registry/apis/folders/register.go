package folders

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ builder.APIGroupBuilder = (*FolderAPIBuilder)(nil)
var _ builder.APIGroupValidation = (*FolderAPIBuilder)(nil)

var resourceInfo = v0alpha1.FolderResourceInfo

var errNoUser = errors.New("valid user is required")
var errNoResource = errors.New("resource name is required")

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	gv                   schema.GroupVersion
	features             featuremgmt.FeatureToggles
	namespacer           request.NamespaceMapper
	folderSvc            folder.Service
	folderPermissionsSvc accesscontrol.FolderPermissionsService
	storage              grafanarest.Storage

	authorizer authorizer.Authorizer

	searcher     resource.ResourceIndexClient
	cfg          *setting.Cfg
	ignoreLegacy bool // skip legacy storage and only use unified storage
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	folderSvc folder.Service,
	folderPermissionsSvc accesscontrol.FolderPermissionsService,
	accessControl accesscontrol.AccessControl,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
) *FolderAPIBuilder {
	if !featuremgmt.AnyEnabled(features,
		featuremgmt.FlagKubernetesClientDashboardsFolders,
		featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		featuremgmt.FlagProvisioning) {
		return nil // skip registration unless opting into Kubernetes folders or unless we want to customize registration when testing
	}

	builder := &FolderAPIBuilder{
		gv:                   resourceInfo.GroupVersion(),
		features:             features,
		namespacer:           request.GetNamespaceMapper(cfg),
		folderSvc:            folderSvc,
		folderPermissionsSvc: folderPermissionsSvc,
		cfg:                  cfg,
		authorizer:           newLegacyAuthorizer(accessControl),
		searcher:             unified,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authtypes.AccessClient) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		gv:           resourceInfo.GroupVersion(),
		namespacer:   request.GetNamespaceMapper(nil),
		authorizer:   newMultiTenantAuthorizer(ac),
		ignoreLegacy: true,
	}
}

func (b *FolderAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.Folder{},
		&v0alpha1.FolderList{},
		&v0alpha1.FolderInfoList{},
		&v0alpha1.DescendantCounts{},
		&v0alpha1.FolderAccessInfo{},
	)
}

func (b *FolderAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, b.gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *FolderAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme
	optsGetter := opts.OptsGetter
	dualWriteBuilder := opts.DualWriteBuilder
	storage := map[string]rest.Storage{}

	if b.ignoreLegacy {
		store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
		if err != nil {
			return err
		}
		storage[resourceInfo.StoragePath()] = store
		apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
		b.storage = storage[resourceInfo.StoragePath()].(grafanarest.Storage)
		return nil
	}

	legacyStore := &legacyStorage{
		service:        b.folderSvc,
		namespacer:     b.namespacer,
		tableConverter: resourceInfo.TableConverter(),
		features:       b.features,
		cfg:            b.cfg,
	}

	opts.StorageOptions(resourceInfo.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true})

	folderStore := &folderStorage{
		tableConverter:       resourceInfo.TableConverter(),
		folderPermissionsSvc: b.folderPermissionsSvc,
		features:             b.features,
		cfg:                  b.cfg,
	}

	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
		if err != nil {
			return err
		}

		dw, err := dualWriteBuilder(resourceInfo.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}

		folderStore.store = dw
	}
	storage[resourceInfo.StoragePath()] = folderStore

	storage[resourceInfo.StoragePath("parents")] = &subParentsREST{
		getter: storage[resourceInfo.StoragePath()].(rest.Getter), // Get the parents
	}
	storage[resourceInfo.StoragePath("counts")] = &subCountREST{searcher: b.searcher}
	storage[resourceInfo.StoragePath("access")] = &subAccessREST{b.folderSvc}

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	b.storage = storage[resourceInfo.StoragePath()].(grafanarest.Storage)
	return nil
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *FolderAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana folders"
	return oas, nil
}

type authorizerParams struct {
	user      identity.Requester
	evaluator accesscontrol.Evaluator
}

func (b *FolderAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

var folderValidationRules = struct {
	maxDepth     int
	invalidNames []string
}{
	maxDepth:     5,
	invalidNames: []string{"general"},
}

func (b *FolderAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	verb := a.GetOperation()
	if verb == admission.Create || verb == admission.Update {
		obj := a.GetObject()
		f, ok := obj.(*v0alpha1.Folder)
		if !ok {
			return fmt.Errorf("obj is not v0alpha1.Folder")
		}
		f.Spec.Title = strings.Trim(f.Spec.Title, "")
		return nil
	}
	return nil
}

func (b *FolderAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	id := a.GetName()
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	f, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return fmt.Errorf("obj is not v0alpha1.Folder")
	}
	verb := a.GetOperation()

	switch verb {
	case admission.Create:
		return b.validateOnCreate(ctx, id, obj)
	case admission.Delete:
		return b.validateOnDelete(ctx, f)
	case admission.Update:
		old := a.GetOldObject()
		if old == nil {
			return fmt.Errorf("old object is nil")
		}
		return b.validateOnUpdate(ctx, obj, old)
	case admission.Connect:
		return nil
	}
	return nil
}

func (b *FolderAPIBuilder) validateOnDelete(ctx context.Context, f *v0alpha1.Folder) error {
	resp, err := b.searcher.GetStats(ctx, &resource.ResourceStatsRequest{Namespace: f.Namespace, Folder: f.Name})
	if err != nil {
		return err
	}

	if resp != nil && resp.Error != nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	if resp.Stats == nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	for _, v := range resp.Stats {
		if v.Count > 0 {
			return folder.ErrFolderNotEmpty
		}
	}

	return nil
}

func (b *FolderAPIBuilder) validateOnCreate(ctx context.Context, id string, obj runtime.Object) error {
	for _, invalidName := range folderValidationRules.invalidNames {
		if id == invalidName {
			return dashboards.ErrFolderInvalidUID
		}
	}

	f, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return fmt.Errorf("obj is not v0alpha1.Folder")
	}
	if f.Spec.Title == "" {
		return dashboards.ErrFolderTitleEmpty
	}

	if f.Name == getParent(obj) {
		return folder.ErrFolderCannotBeParentOfItself
	}

	_, err := b.checkFolderMaxDepth(ctx, obj)
	if err != nil {
		return err
	}

	return err
}

func getParent(o runtime.Object) string {
	meta, err := utils.MetaAccessor(o)
	if err != nil {
		return ""
	}
	return meta.GetFolder()
}

func (b *FolderAPIBuilder) checkFolderMaxDepth(ctx context.Context, obj runtime.Object) ([]string, error) {
	var parents = []string{}
	for i := 0; i < folderValidationRules.maxDepth; i++ {
		parent := getParent(obj)
		if parent == "" {
			break
		}
		parents = append(parents, parent)
		if i+1 == folderValidationRules.maxDepth {
			return parents, folder.ErrMaximumDepthReached
		}

		parentObj, err := b.storage.Get(ctx, parent, &metav1.GetOptions{})
		if err != nil {
			return parents, err
		}
		obj = parentObj
	}
	return parents, nil
}

func (b *FolderAPIBuilder) validateOnUpdate(ctx context.Context, obj, old runtime.Object) error {
	f, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return fmt.Errorf("obj is not v0alpha1.Folder")
	}

	fOld, ok := old.(*v0alpha1.Folder)
	if !ok {
		return fmt.Errorf("obj is not v0alpha1.Folder")
	}
	var newParent = getParent(obj)
	if newParent != getParent(fOld) {
		// it's a move operation
		return b.validateMove(ctx, obj, newParent)
	}
	// it's a spec update
	if f.Spec.Title == "" {
		return dashboards.ErrFolderTitleEmpty
	}
	return nil
}

func (b *FolderAPIBuilder) validateMove(ctx context.Context, obj runtime.Object, newParent string) error {
	// folder cannot be moved to a k6 folder
	if newParent == accesscontrol.K6FolderUID {
		return fmt.Errorf("k6 project may not be moved")
	}

	//FIXME: until we have a way to represent the tree, we can only
	// look at folder parents to check how deep the new folder tree will be
	parents, err := b.checkFolderMaxDepth(ctx, obj)
	if err != nil {
		return err
	}

	// if by moving a folder we exceed the max depth, return an error
	if len(parents)+1 >= folderValidationRules.maxDepth {
		return folder.ErrMaximumDepthReached
	}
	return nil
}

package folders

import (
	"context"
	"errors"
	"fmt"
	"slices"
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

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
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
	accessControl        accesscontrol.AccessControl
	searcher             resource.ResourceIndexClient
	cfg                  *setting.Cfg
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
		featuremgmt.FlagKubernetesFolders,
		featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
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
		accessControl:        accessControl,
		searcher:             unified,
	}
	apiregistration.RegisterAPI(builder)
	return builder
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

	legacyStore := &legacyStorage{
		service:              b.folderSvc,
		namespacer:           b.namespacer,
		tableConverter:       resourceInfo.TableConverter(),
		folderPermissionsSvc: b.folderPermissionsSvc,
		features:             b.features,
		cfg:                  b.cfg,
	}

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = legacyStore
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
		if err != nil {
			return err
		}
		storage[resourceInfo.StoragePath()], err = dualWriteBuilder(resourceInfo.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}
	}
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
	// The plugin description
	oas.Info.Description = "Grafana folders"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+v0alpha1.FolderResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+v0alpha1.FolderResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

type authorizerParams struct {
	user      identity.Requester
	evaluator accesscontrol.Evaluator
}

func (b *FolderAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		in, err := authorizerFunc(ctx, attr)
		if err != nil {
			if errors.Is(err, errNoUser) {
				return authorizer.DecisionDeny, "", nil
			}
			return authorizer.DecisionNoOpinion, "", nil
		}

		ok, err := b.accessControl.Evaluate(ctx, in.user, in.evaluator)
		if ok {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "folder", err
	})
}

func authorizerFunc(ctx context.Context, attr authorizer.Attributes) (*authorizerParams, error) {
	allowedVerbs := []string{utils.VerbCreate, utils.VerbDelete, utils.VerbList}
	verb := attr.GetVerb()
	name := attr.GetName()
	if (!attr.IsResourceRequest()) || (name == "" && verb != utils.VerbCreate && slices.Contains(allowedVerbs, verb)) {
		return nil, errNoResource
	}

	// require a user
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, errNoUser
	}

	scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(name)
	var eval accesscontrol.Evaluator

	// "get" is used for sub-resources with GET http (parents, access, count)
	switch verb {
	case utils.VerbCreate:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersCreate)
	case utils.VerbPatch:
		fallthrough
	case utils.VerbUpdate:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, scope)
	case utils.VerbDeleteCollection:
		fallthrough
	case utils.VerbDelete:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, scope)
	case utils.VerbList:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersRead)
	default:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersRead, scope)
	}
	return &authorizerParams{evaluator: eval, user: user}, nil
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

package folders

import (
	"context"
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
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
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
	gv                   schema.GroupVersion
	features             featuremgmt.FeatureToggles
	namespacer           request.NamespaceMapper
	folderSvc            folder.Service
	folderPermissionsSvc accesscontrol.FolderPermissionsService
	acService            accesscontrol.Service
	ac                   accesscontrol.AccessControl
	storage              grafanarest.Storage

	authorizer authorizer.Authorizer
	parents    parentsGetter

	searcher     resourcepb.ResourceIndexClient
	cfg          *setting.Cfg
	ignoreLegacy bool // skip legacy storage and only use unified storage
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	accessClient authlib.AccessClient,
	folderSvc folder.Service,
	folderPermissionsSvc accesscontrol.FolderPermissionsService,
	accessControl accesscontrol.AccessControl,
	acService accesscontrol.Service,
	registerer prometheus.Registerer,
	unified resource.ResourceClient,
) *FolderAPIBuilder {
	builder := &FolderAPIBuilder{
		gv:                   resourceInfo.GroupVersion(),
		features:             features,
		namespacer:           request.GetNamespaceMapper(cfg),
		folderSvc:            folderSvc,
		folderPermissionsSvc: folderPermissionsSvc,
		acService:            acService,
		ac:                   accessControl,
		cfg:                  cfg,
		authorizer:           newAuthorizer(accessClient),
		searcher:             unified,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient) *FolderAPIBuilder {
	return &FolderAPIBuilder{
		gv:           resourceInfo.GroupVersion(),
		namespacer:   request.GetNamespaceMapper(nil),
		authorizer:   newAuthorizer(ac),
		ignoreLegacy: true,
	}
}

func (b *FolderAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
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

func (b *FolderAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
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
		apiGroupInfo.VersionedResourcesStorageMap[folders.VERSION] = storage
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

	opts.StorageOptsRegister(resourceInfo.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true})

	folderStore := &folderStorage{
		tableConverter:       resourceInfo.TableConverter(),
		folderPermissionsSvc: b.folderPermissionsSvc,
		acService:            b.acService,
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

	b.parents = newParentsGetter(folderStore, folderValidationRules.maxDepth) // used for validation
	storage[resourceInfo.StoragePath("parents")] = &subParentsREST{
		getter:  folderStore,
		parents: b.parents,
	}
	storage[resourceInfo.StoragePath("counts")] = &subCountREST{searcher: b.searcher}
	storage[resourceInfo.StoragePath("access")] = &subAccessREST{b.folderSvc, b.ac}

	// Adds a path to return children of a given folder
	storage[resourceInfo.StoragePath("children")] = &subChildrenREST{
		lister: storage[resourceInfo.StoragePath()].(rest.Lister),
	}

	apiGroupInfo.VersionedResourcesStorageMap[folders.VERSION] = storage
	b.storage = storage[resourceInfo.StoragePath()].(grafanarest.Storage)
	return nil
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return folders.GetOpenAPIDefinitions
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
	maxDepth int
}{
	maxDepth: 5, // why different than folder.MaxNestedFolderDepth?? (4)
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
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	f, ok := obj.(*folders.Folder)
	if !ok {
		return fmt.Errorf("obj is not folders.Folder")
	}

	switch a.GetOperation() {
	case admission.Create:
		return validateOnCreate(ctx, f, b.parents, folderValidationRules.maxDepth)
	case admission.Delete:
		return validateOnDelete(ctx, f, b.searcher)
	case admission.Update:
		old, ok := a.GetOldObject().(*folders.Folder)
		if !ok {
			return fmt.Errorf("obj is not folders.Folder")
		}
		return validateOnUpdate(ctx, f, old, b.storage, b.parents, folderValidationRules.maxDepth)
	default:
		return nil
	}
}

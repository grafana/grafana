package folders

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/folders/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/services/grafana-apiserver/rest"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

var _ grafanaapiserver.APIGroupBuilder = (*FolderAPIBuilder)(nil)

var resourceInfo = v0alpha1.FolderResourceInfo

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	gv         schema.GroupVersion
	features   *featuremgmt.FeatureManager
	namespacer request.NamespaceMapper
	folderSvc  folder.Service
}

func RegisterAPIService(cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	apiregistration grafanaapiserver.APIRegistrar,
	folderSvc folder.Service,
) *FolderAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &FolderAPIBuilder{
		gv:         resourceInfo.GroupVersion(),
		features:   features,
		namespacer: request.GetNamespaceMapper(cfg),
		folderSvc:  folderSvc,
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
		&v0alpha1.FolderInfo{},
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

func (b *FolderAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v0alpha1.GROUP, scheme, metav1.ParameterCodec, codecs)

	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	store.TableConvertor = utils.NewTableConverter(
		store.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name"},
			{Name: "Parent", Type: "string", Format: "string", Description: "Parent folder UID"},
		},
		func(obj any) ([]interface{}, error) {
			r, ok := obj.(*v0alpha1.Folder)
			if ok {
				accessor, _ := utils.MetaAccessor(r)
				return []interface{}{
					r.Name,
					r.Spec.Title,
					accessor.GetFolder(),
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		})
	legacyStore := &legacyStorage{
		service:        b.folderSvc,
		namespacer:     b.namespacer,
		tableConverter: store.TableConvertor,
	}

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = legacyStore
	storage[resourceInfo.StoragePath("parents")] = &subParentsREST{b.folderSvc}
	storage[resourceInfo.StoragePath("children")] = &subChildrenREST{b.folderSvc}

	// enable dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil {
		store, err := newStorage(scheme, optsGetter, legacyStore)
		if err != nil {
			return nil, err
		}
		storage[resourceInfo.StoragePath()] = grafanarest.NewDualWriter(legacyStore, store)
	}

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *FolderAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}

func (b *FolderAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // TODO: the FGAC rules encoded in the service can be moved here
}

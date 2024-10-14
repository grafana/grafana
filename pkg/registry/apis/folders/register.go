package folders

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

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
)

var _ builder.APIGroupBuilder = (*FolderAPIBuilder)(nil)

var resourceInfo = v0alpha1.FolderResourceInfo

// This is used just so wire has something unique to return
type FolderAPIBuilder struct {
	gv            schema.GroupVersion
	features      featuremgmt.FeatureToggles
	namespacer    request.NamespaceMapper
	folderSvc     folder.Service
	accessControl accesscontrol.AccessControl
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	folderSvc folder.Service,
	accessControl accesscontrol.AccessControl,
	registerer prometheus.Registerer,
) *FolderAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesFolders) && !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs) {
		return nil // skip registration unless opting into Kubernetes folders or unless we want to customise registration when testing
	}

	builder := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      features,
		namespacer:    request.GetNamespaceMapper(cfg),
		folderSvc:     folderSvc,
		accessControl: accessControl,
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

func (b *FolderAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, dualWriteBuilder grafanarest.DualWriteBuilder) error {
	legacyStore := &legacyStorage{
		service:        b.folderSvc,
		namespacer:     b.namespacer,
		tableConverter: resourceInfo.TableConverter(),
	}

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = legacyStore
	storage[resourceInfo.StoragePath("parents")] = &subParentsREST{b.folderSvc}
	storage[resourceInfo.StoragePath("count")] = &subCountREST{b.folderSvc}
	storage[resourceInfo.StoragePath("access")] = &subAccessREST{b.folderSvc}

	// enable dual writer
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

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return nil
}

func (b *FolderAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *FolderAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
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

func (b *FolderAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			verb := attr.GetVerb()
			name := attr.GetName()
			if (!attr.IsResourceRequest()) || (name == "" && verb != utils.VerbCreate) {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// require a user
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(name)
			eval := accesscontrol.EvalPermission(dashboards.ActionFoldersRead, scope)

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
			}

			ok, err := b.accessControl.Evaluate(ctx, user, eval)
			if ok {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "folder", err
		})
}

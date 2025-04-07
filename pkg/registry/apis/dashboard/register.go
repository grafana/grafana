package dashboard

import (
	"maps"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	internal "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

var (
	_ builder.APIGroupBuilder          = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor     = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider    = (*DashboardsAPIBuilder)(nil)
)

const (
	dashboardSpecTitle           = "title"
	dashboardSpecRefreshInterval = "refresh"
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService
	features         featuremgmt.FeatureToggles

	accessControl                accesscontrol.AccessControl
	legacy                       *DashboardStorage
	unified                      resource.ResourceClient
	dashboardProvisioningService dashboards.DashboardProvisioningService
	scheme                       *runtime.Scheme
	search                       *SearchHandler
	dashStore                    dashboards.Store
	folderStore                  folder.FolderStore
	QuotaService                 quota.Service
	ProvisioningService          provisioning.ProvisioningService
	cfg                          *setting.Cfg
	dualWriter                   dualwrite.Service
	folderClient                 client.K8sHandler

	log log.Logger
	reg prometheus.Registerer
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	provisioningDashboardService dashboards.DashboardProvisioningService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
	dual dualwrite.Service,
	sorter sort.Service,
	quotaService quota.Service,
	folderStore folder.FolderStore,
	restConfigProvider apiserver.RestConfigProvider,
	userService user.Service,
) *DashboardsAPIBuilder {
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	legacyDashboardSearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	folderClient := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), folderv0alpha1.FolderResourceInfo.GroupVersionResource(), restConfigProvider.GetRestConfig, dashStore, userService, unified, sorter)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards"),

		dashboardService:             dashboardService,
		features:                     features,
		accessControl:                accessControl,
		unified:                      unified,
		dashboardProvisioningService: provisioningDashboardService,
		search:                       NewSearchHandler(tracing, dual, legacyDashboardSearcher, unified, features),
		dashStore:                    dashStore,
		folderStore:                  folderStore,
		QuotaService:                 quotaService,
		ProvisioningService:          provisioning,
		cfg:                          cfg,
		dualWriter:                   dual,
		folderClient:                 folderClient,

		legacy: &DashboardStorage{
			Access:           legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, sorter),
			DashboardService: dashboardService,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	if featuremgmt.AnyEnabled(b.features, featuremgmt.FlagDashboardNewLayouts) {
		// If dashboards v2 is enabled, we want to use v2alpha1 as the default API version.
		return []schema.GroupVersion{
			v2alpha1.DashboardResourceInfo.GroupVersion(),
			v0alpha1.DashboardResourceInfo.GroupVersion(),
			v1alpha1.DashboardResourceInfo.GroupVersion(),
		}
	}

	return []schema.GroupVersion{
		v1alpha1.DashboardResourceInfo.GroupVersion(),
		v0alpha1.DashboardResourceInfo.GroupVersion(),
		v2alpha1.DashboardResourceInfo.GroupVersion(),
	}
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	b.scheme = scheme
	if err := v0alpha1.AddToScheme(scheme); err != nil {
		return err
	}
	if err := v1alpha1.AddToScheme(scheme); err != nil {
		return err
	}
	if err := v2alpha1.AddToScheme(scheme); err != nil {
		return err
	}

	// Register the explicit conversions
	if err := conversion.RegisterConversions(scheme); err != nil {
		return err
	}

	return scheme.SetVersionPriority(b.GetGroupVersions()...)
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storageOpts := apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	if b.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = NewDashboardLargeObjectSupport(opts.Scheme)
		storageOpts.LargeObjectSupport = largeObjects
	}
	opts.StorageOptions(v0alpha1.DashboardResourceInfo.GroupResource(), storageOpts)

	// v0alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		v0alpha1.DashboardResourceInfo,
		&v0alpha1.LibraryPanelResourceInfo,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v0alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v0alpha1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	// v1alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		v1alpha1.DashboardResourceInfo,
		nil, // do not register library panel
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v1alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v1alpha1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	// v2alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		v2alpha1.DashboardResourceInfo,
		nil, // do not register library panel
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v2alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v2alpha1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	return nil
}

func (b *DashboardsAPIBuilder) storageForVersion(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	largeObjects apistore.LargeObjectSupport,
	dashboards utils.ResourceInfo,
	libraryPanels *utils.ResourceInfo,
	newDTOFunc dtoBuilder,
) error {
	// Register the versioned storage
	storage := map[string]rest.Storage{}
	apiGroupInfo.VersionedResourcesStorageMap[dashboards.GroupVersion().Version] = storage

	legacyStore, err := b.legacy.NewStore(dashboards, opts.Scheme, opts.OptsGetter, b.reg)
	if err != nil {
		return err
	}

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, dashboards, opts.OptsGetter)
	if err != nil {
		return err
	}

	gr := dashboards.GroupResource()
	storage[dashboards.StoragePath()], err = opts.DualWriteBuilder(gr, legacyStore, store)
	if err != nil {
		return err
	}

	// Register the DTO endpoint that will consolidate all dashboard bits
	storage[dashboards.StoragePath("dto")], err = NewDTOConnector(
		storage[dashboards.StoragePath()].(rest.Getter),
		largeObjects,
		b.legacy.Access,
		b.unified,
		b.accessControl,
		opts.Scheme,
		newDTOFunc,
	)
	if err != nil {
		return err
	}

	// Expose read only library panels
	if libraryPanels != nil {
		storage[libraryPanels.StoragePath()] = &LibraryPanelStore{
			Access:       b.legacy.Access,
			ResourceInfo: *libraryPanels,
		}
	}

	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() openapi.GetOpenAPIDefinitions {
	return func(ref openapi.ReferenceCallback) map[string]openapi.OpenAPIDefinition {
		defs := v0alpha1.GetOpenAPIDefinitions(ref)
		maps.Copy(defs, v1alpha1.GetOpenAPIDefinitions(ref))
		maps.Copy(defs, v2alpha1.GetOpenAPIDefinitions(ref))
		return defs
	}
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana dashboards as resources"
	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if gv.Version != v0alpha1.VERSION {
		return nil // Only show the custom routes for v0
	}

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.search.GetAPIRoutes(defs)
}

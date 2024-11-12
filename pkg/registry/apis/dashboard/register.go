package dashboard

import (
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ builder.APIGroupBuilder      = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor = (*DashboardsAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService

	accessControl accesscontrol.AccessControl
	legacy        *dashboardStorage
	unified       resource.ResourceClient

	log log.Logger
	reg prometheus.Registerer
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
) *DashboardsAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) && !features.IsEnabledGlobally(featuremgmt.FlagKubernetesDashboardsAPI) {
		return nil // skip registration unless opting into experimental apis or dashboards in the k8s api
	}

	softDelete := features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore)
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards"),

		dashboardService: dashboardService,
		accessControl:    accessControl,
		unified:          unified,

		legacy: &dashboardStorage{
			resource:       dashboard.DashboardResourceInfo,
			access:         legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, softDelete),
			tableConverter: dashboard.DashboardResourceInfo.TableConverter(),
			features:       features,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dashboard.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilder) GetDesiredDualWriterMode(dualWrite bool, modeMap map[string]grafanarest.DualWriterMode) grafanarest.DualWriterMode {
	// Add required configuration support in order to enable other modes. For an example, see pkg/registry/apis/playlist/register.go
	return grafanarest.Mode0
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&dashboard.Dashboard{},
		&dashboard.DashboardList{},
		&dashboard.DashboardWithAccessInfo{},
		&dashboard.DashboardVersionList{},
		&dashboard.VersionsQueryOptions{},
		&dashboard.LibraryPanel{},
		&dashboard.LibraryPanelList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	resourceInfo := dashboard.DashboardResourceInfo
	addKnownTypes(scheme, resourceInfo.GroupVersion())

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   resourceInfo.GroupVersion().Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, resourceInfo.GroupVersion())
	return scheme.SetVersionPriority(resourceInfo.GroupVersion())
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme

	optsGetter := opts.OptsGetter
	dualWriteBuilder := opts.DualWriteBuilder
	dash := b.legacy.resource
	legacyStore, err := b.legacy.newStore(scheme, optsGetter, b.reg)
	if err != nil {
		return err
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	if b.legacy.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = newDashboardLargeObjectSupport()
		opts.StorageOptions(dash.GroupResource(), apistore.StorageOptions{
			LargeObjectSupport: largeObjects,
		})
	}

	storage := map[string]rest.Storage{}
	storage[dash.StoragePath()] = legacyStore
	storage[dash.StoragePath("history")] = apistore.NewHistoryConnector(
		b.legacy.server, // as client???
		dashboard.DashboardResourceInfo.GroupResource(),
	)

	// Dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(scheme, dash, optsGetter)
		if err != nil {
			return err
		}
		storage[dash.StoragePath()], err = dualWriteBuilder(dash.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}
	}

	// Register the DTO endpoint that will consolidate all dashboard bits
	storage[dash.StoragePath("dto")], err = newDTOConnector(storage[dash.StoragePath()], largeObjects, b)
	if err != nil {
		return err
	}

	// Expose read only library panels
	storage[dashboard.LibraryPanelResourceInfo.StoragePath()] = &libraryPanelStore{
		access: b.legacy.access,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboard.VERSION] = storage
	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboard.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana dashboards as resources"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+dashboard.DashboardResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+dashboard.DashboardResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

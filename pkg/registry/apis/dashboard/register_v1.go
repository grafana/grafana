package dashboard

import (
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
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
	_ builder.APIGroupBuilder      = (*DashboardsAPIBuilderV1)(nil)
	_ builder.OpenAPIPostProcessor = (*DashboardsAPIBuilderV1)(nil)
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilderV1 struct {
	dashboardService dashboards.DashboardService

	accessControl accesscontrol.AccessControl
	legacy        *dashboardStorage
	unified       resource.ResourceClient

	log log.Logger
	reg prometheus.Registerer
}

func RegisterAPIServiceV1(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
) *DashboardsAPIBuilderV1 {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) && !features.IsEnabledGlobally(featuremgmt.FlagKubernetesDashboardsAPI) {
		return nil // skip registration unless opting into experimental apis or dashboards in the k8s api
	}

	softDelete := features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore)
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilderV1{
		log: log.New("grafana-apiserver.dashboards"),

		dashboardService: dashboardService,
		accessControl:    accessControl,
		unified:          unified,

		legacy: &dashboardStorage{
			resource:       dashboardv1.DashboardResourceInfo,
			access:         legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, softDelete),
			tableConverter: dashboardv1.DashboardResourceInfo.TableConverter(),
			features:       features,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilderV1) GetGroupVersion() schema.GroupVersion {
	return dashboardv1.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilderV1) GetAuthorizer() authorizer.Authorizer {
	return GetAuthorizer(b.dashboardService, b.log)
}

func (b *DashboardsAPIBuilderV1) GetDesiredDualWriterMode(dualWrite bool, modeMap map[string]grafanarest.DualWriterMode) grafanarest.DualWriterMode {
	// Add required configuration support in order to enable other modes. For an example, see pkg/registry/apis/playlist/register.go
	return grafanarest.Mode0
}

func (b *DashboardsAPIBuilderV1) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(dashboardv1.SchemeGroupVersion,
		&dashboardv1.Dashboard{},
		&dashboardv1.DashboardList{},
		&dashboardv1.DashboardWithAccessInfo{},
		&dashboardv1.DashboardVersionList{},
		&dashboardv1.VersionsQueryOptions{},
		&dashboardv1.LibraryPanel{},
		&dashboardv1.LibraryPanelList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)

	if !scheme.Recognizes(dashboard.DashboardResourceInfo.GroupVersionKind()) {
		scheme.AddKnownTypes(dashboard.SchemeGroupVersion,
			&dashboard.Dashboard{},
			&dashboard.DashboardList{},
			&dashboard.DashboardWithAccessInfo{},
			&dashboard.DashboardVersionList{},
			&dashboard.VersionsQueryOptions{},
			&dashboard.LibraryPanel{},
			&dashboard.LibraryPanelList{},
		)
	}

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	if err := dashboardv1.RegisterConversions(scheme); err != nil {
		return err
	}
	metav1.AddToGroupVersion(scheme, dashboardv1.DashboardResourceInfo.GroupVersion())
	return scheme.SetVersionPriority(dashboardv1.DashboardResourceInfo.GroupVersion())
}

func (b *DashboardsAPIBuilderV1) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
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
		dashboardv1.DashboardResourceInfo.GroupResource(),
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
	storage[dashboardv1.LibraryPanelResourceInfo.StoragePath()] = &libraryPanelStore{
		access: b.legacy.access,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboardv1.VERSION] = storage
	return nil
}

func (b *DashboardsAPIBuilderV1) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboardv1.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilderV1) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana dashboards as resources"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+dashboardv1.DashboardResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+dashboardv1.DashboardResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (b *DashboardsAPIBuilderV1) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

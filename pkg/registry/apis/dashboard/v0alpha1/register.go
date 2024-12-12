package v0alpha1

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard"
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
	legacy        *dashboard.DashboardStorage
	search        *dashboard.SearchHandler
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
	softDelete := features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore)
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards.v0alpha1"),

		dashboardService: dashboardService,
		accessControl:    accessControl,
		unified:          unified,
		search:           dashboard.NewSearchHandler(unified, tracing),

		legacy: &dashboard.DashboardStorage{
			Resource:       dashboardv0alpha1.DashboardResourceInfo,
			Access:         legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, softDelete),
			TableConverter: dashboardv0alpha1.DashboardResourceInfo.TableConverter(),
			Features:       features,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dashboardv0alpha1.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return dashboard.GetAuthorizer(b.dashboardService, b.log)
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	return dashboardv0alpha1.AddToScheme(scheme)
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme

	optsGetter := opts.OptsGetter
	dualWriteBuilder := opts.DualWriteBuilder
	dash := b.legacy.Resource
	legacyStore, err := b.legacy.NewStore(scheme, optsGetter, b.reg)
	if err != nil {
		return err
	}

	defaultOpts, err := optsGetter.GetRESTOptions(b.legacy.Resource.GroupResource(), &dashboardinternal.Dashboard{})
	if err != nil {
		return err
	}
	storageOpts := apistore.StorageOptions{
		InternalConversion: (func(b []byte, desiredObj runtime.Object) (runtime.Object, error) {
			internal := &dashboardinternal.Dashboard{}
			obj, _, err := defaultOpts.StorageConfig.Config.Codec.Decode(b, nil, internal)
			if err != nil {
				return nil, err
			}

			err = scheme.Convert(obj, desiredObj, nil)
			return desiredObj, err
		}),
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	if b.legacy.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = dashboard.NewDashboardLargeObjectSupport(scheme)
		storageOpts.LargeObjectSupport = largeObjects
	}
	opts.StorageOptions(dash.GroupResource(), storageOpts)

	storage := map[string]rest.Storage{}
	storage[dash.StoragePath()] = legacyStore
	storage[dash.StoragePath("history")] = apistore.NewHistoryConnector(
		b.legacy.Server, // as client???
		dashboardv0alpha1.DashboardResourceInfo.GroupResource(),
	)

	if optsGetter == nil {
		return errors.New("missing RESTOptionsGetter")
	}

	// Dual writes if a RESTOptionsGetter is provided
	if dualWriteBuilder != nil {
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
	storage[dash.StoragePath("dto")], err = dashboard.NewDTOConnector(
		storage[dash.StoragePath()],
		largeObjects,
		b.legacy.Access,
		b.unified,
		b.accessControl,
		scheme,
		func() runtime.Object { return &dashboardv0alpha1.DashboardWithAccessInfo{} },
	)
	if err != nil {
		return err
	}

	// Expose read only library panels
	storage[dashboardv0alpha1.LibraryPanelResourceInfo.StoragePath()] = &dashboard.LibraryPanelStore{
		Access:       b.legacy.Access,
		ResourceInfo: dashboardv0alpha1.LibraryPanelResourceInfo,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboardv0alpha1.VERSION] = storage
	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboardv0alpha1.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana dashboards as resources"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+dashboardv0alpha1.DashboardResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+dashboardv0alpha1.DashboardResourceInfo.GroupResource().Resource)

	// Resolve the empty name
	sub := oas.Paths.Paths[root+"search/{name}"]
	oas.Paths.Paths[root+"search"] = sub
	delete(oas.Paths.Paths, root+"search/{name}")

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.search.GetAPIRoutes(defs)
}

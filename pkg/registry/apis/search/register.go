package search

import (
	"path"

	searchv0alpha1 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

var (
	_ builder.APIGroupBuilder          = (*SearchAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*SearchAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor     = (*SearchAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider    = (*SearchAPIBuilder)(nil)
)

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
) *SearchAPIBuilder {
	legacyDashboardSearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	builder := &SearchAPIBuilder{
		log: log.New("grafana-apiserver.search"),

		unified: unified,
		search:  NewSearchHandler(tracing, dual, legacyDashboardSearcher, unified, features),
		reg:     reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

type SearchAPIBuilder struct {
	unified resource.ResourceClient
	scheme  *runtime.Scheme
	search  *SearchHandler

	log log.Logger
	reg prometheus.Registerer
}

// GetAPIRoutes implements builder.APIGroupRouteProvider.
func (s *SearchAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := s.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return s.search.GetAPIRoutes(defs)
}

// PostProcessOpenAPI implements builder.OpenAPIPostProcessor.
func (s *SearchAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Search grafana resources"
	root := path.Join("/apis/", searchv0alpha1.GROUP, searchv0alpha1.VERSION)
	sub := oas.Paths.Paths[path.Join(root, "search", "{name}")]
	oas.Paths.Paths[path.Join(root, "search")] = sub
	delete(oas.Paths.Paths, path.Join(root, "search", "{name}"))

	return oas, nil
}

// GetGroupVersions implements builder.APIGroupVersionsProvider.
func (s *SearchAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	return []schema.GroupVersion{
		searchv0alpha1.ResourceInfo.GroupVersion(),
	}
}

// GetOpenAPIDefinitions implements builder.APIGroupBuilder.
func (s *SearchAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := searchv0alpha1.GetOpenAPIDefinitions(ref)
		return defs
	}
}

// InstallSchema implements builder.APIGroupBuilder.
func (s *SearchAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	s.scheme = scheme
	if err := searchv0alpha1.AddToScheme(scheme); err != nil {
		return err
	}
	scheme.SetVersionPriority(s.GetGroupVersions()...)
	return nil
}

// UpdateAPIGroupInfo implements builder.APIGroupBuilder.
func (s *SearchAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, searchv0alpha1.ResourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage := map[string]rest.Storage{}
	storage[searchv0alpha1.ResourceInfo.StoragePath()] = store

	apiGroupInfo.VersionedResourcesStorageMap[searchv0alpha1.VERSION] = storage
	return nil
}

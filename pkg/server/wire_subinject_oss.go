//go:build wireinject && oss
// +build wireinject,oss

package server

import (
	"github.com/google/wire"
	promclient "github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/authz"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	search2 "github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

var ossBaseCLISet = wire.NewSet(
	NewModuleRunner,
	metrics.WireSet,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	hooks.ProvideService,
	setting.ProvideProvider, wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	configprovider.ProvideService,
)

var moduleServerSet = wire.NewSet(
	NewModule,
	ossBaseCLISet,
	tracing.ProvideTracingConfig,
	tracing.ProvideService,
	wire.Bind(new(tracing.Tracer), new(*tracing.TracingService)),
	resource.ProvideStorageMetrics,
	resource.ProvideIndexMetrics,
	resource.ProvideVectorMetrics,
	ProvideNoopModuleRegisterer,
	sql.ProvideStorageBackend,
	sql.ProvideExperimentalKV,
	zStore.ProvideDefaultStoreProvider,
	authz.ProvideReconcileCRDs,
)

var dashboardStatsSet = wire.NewSet(
	builders.ProvideDashboardStats,
	wire.Bind(new(builders.DashboardStats), new(*builders.OssDashboardStats)),
)

var searchSupportSet = wire.NewSet(
	dashboardStatsSet,
	migrations.ProvideOSSMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*migrations.OSSMigrations)),
	bus.ProvideBus,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	sqlstore.ProvideService,
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	search2.ProvideDocumentBuilders,
)

// InitializeModuleServer is a simplified set of dependencies for the CLI,
// suitable for running background services and targeting dskit modules.
func InitializeModuleServer(cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*ModuleServer, error) {
	wire.Build(moduleServerSet)
	return &ModuleServer{}, nil
}

// InitializeSearchSupport builds the document builders together with the
// dashboard stats they use, so the storage-server target shares a single
// stats instance (and a single metrics registration) between the search
// document builders and the vector backfiller. It receives the dependencies
// the module server has already constructed so they aren't recreated.
func InitializeSearchSupport(cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg promclient.Registerer) (SearchSupport, error) {
	wire.Build(searchSupportSet, wire.Struct(new(SearchSupport), "*"))
	return SearchSupport{}, nil
}

// InitializeDashboardStats builds only the dashboard stats dependency used by
// the vector backfiller views filter, for the storage-server target running
// without enable_search. It receives the dependencies the module server has
// already constructed so they aren't recreated.
func InitializeDashboardStats(cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg promclient.Registerer) (builders.DashboardStats, error) {
	wire.Build(dashboardStatsSet)
	return nil, nil
}

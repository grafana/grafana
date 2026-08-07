//go:build wireinject && (enterprise || pro)
// +build wireinject
// +build enterprise pro

// Enterprise Wire injectors for the module server and its sub-graphs. These
// stay in pkg/server (rather than moving to bootstrap/wire with the full-server
// injectors) because ModuleServer calls InitializeSearchSupport and
// InitializeDashboardStats lazily during module startup. Mirrors
// wire_subinject_oss.go on the OSS side.
package server

import (
	"context"

	"github.com/google/wire"
	promclient "github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// InitializeForCLITarget is a simplified set of dependencies for the CLI, used
// by the server target subcommand to launch specific dskit modules.
func InitializeForCLITarget(ctx context.Context, cfg *setting.Cfg) (ModuleRunner, error) {
	wire.Build(wireExtsBaseCLISet)
	return ModuleRunner{}, nil
}

// InitializeModuleServer is a simplified set of dependencies for the CLI,
// suitable for running background services and targeting dskit modules.
func InitializeModuleServer(cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*ModuleServer, error) {
	wire.Build(wireExtsModuleServerSet)
	return &ModuleServer{}, nil
}

// InitializeSearchSupport builds the document builders together with the
// dashboard stats they use, so the storage-server target shares a single
// stats instance (and a single metrics registration) between the search
// document builders and the vector backfiller. It receives the dependencies
// the module server has already constructed so they aren't recreated.
func InitializeSearchSupport(cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg promclient.Registerer) (SearchSupport, error) {
	wire.Build(wireExtsSearchSupportSet, wire.Struct(new(SearchSupport), "*"))
	return SearchSupport{}, nil
}

// InitializeDashboardStats builds only the dashboard stats dependency used by
// the vector backfiller views filter, for the storage-server target running
// without enable_search. It receives the dependencies the module server has
// already constructed so they aren't recreated.
func InitializeDashboardStats(cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg promclient.Registerer) (builders.DashboardStats, error) {
	wire.Build(wireExtsDashboardStatsSet)
	return nil, nil
}

//go:build wireinject && (enterprise || pro)
// +build wireinject
// +build enterprise pro

// Enterprise Wire injectors. Core provider sets live in wire_core.go; edition
// bindings live in the overlaid wireexts_enterprise.go.
package server

import (
	"context"

	"github.com/google/wire"
	promclient "github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func Initialize(ctx context.Context, cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*Server, error) {
	wire.Build(wireExtsSet)
	return &Server{}, nil
}

func InitializeForTest(ctx context.Context, t sqlutil.ITestDB, testingT interface {
	mock.TestingT
	Cleanup(func())
}, cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions,
) (*TestEnv, error) {
	wire.Build(wireExtsTestSet)
	return &TestEnv{Server: &Server{}, TestingT: testingT, SQLStore: &sqlstore.SQLStore{}, Cfg: &setting.Cfg{}}, nil
}

func InitializeForCLI(ctx context.Context, cfg *setting.Cfg) (Runner, error) {
	wire.Build(wireExtsCLISet)
	return Runner{}, nil
}

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

// Initialize the standalone APIServer factory
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(wireExtsStandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
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

//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"context"

	"github.com/google/wire"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/server/wireext"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/pluginrouter"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

func Initialize(ctx context.Context, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
	wire.Build(Server, wireext.BasicSet)
	return &server.Server{}, nil
}

func InitializeForTest(ctx context.Context, t sqlutil.ITestDB, testingT interface {
	mock.TestingT
	Cleanup(func())
}, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions,
) (*server.TestEnv, error) {
	wire.Build(Test, wireext.BasicSet)
	return &server.TestEnv{Server: &server.Server{}, TestingT: testingT, SQLStore: &sqlstore.SQLStore{}, Cfg: &setting.Cfg{}}, nil
}

func InitializeForCLI(ctx context.Context, cfg *setting.Cfg) (server.Runner, error) {
	wire.Build(CLI, wireext.BasicSet)
	return server.Runner{}, nil
}

// InitializeForCLITarget is a simplified set of dependencies for the CLI, used
// by the server target subcommand to launch specific dskit modules.
func InitializeForCLITarget(ctx context.Context, cfg *setting.Cfg) (server.ModuleRunner, error) {
	wire.Build(BaseCLISet)
	return server.ModuleRunner{}, nil
}

// InitializePluginRouterDeps builds the plugin stack the plugin-router module serves
// through: the plugin store that loads plugins and starts their backends, the
// clients that talk to them, and the sources they were discovered in.
//
// It is built from the CLI set rather than a set of its own because a plugin
// backend cannot be started without most of what a Grafana server is made of --
// the database the plugin stack keeps its state in, access control for the
// roles a plugin declares, external service accounts, the core plugin registry
// the backend factory is built from. What the module leaves out is the HTTP
// server in front of all of it.
func InitializePluginRouterDeps(ctx context.Context, cfg *setting.Cfg) (pluginrouter.PluginDeps, error) {
	wire.Build(CLI, wireext.BasicSet, wire.Struct(new(pluginrouter.PluginDeps), "*"))
	return pluginrouter.PluginDeps{}, nil
}

// Initialize the standalone APIServer factory
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(StandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
}

// Initialize the standalone router factory
func InitializeRouterFactory() (router.RouterFactory, error) {
	wire.Build(RouterFactorySet)
	return &router.NoOpRouterFactory{}, nil // Wire will replace this with a real interface
}

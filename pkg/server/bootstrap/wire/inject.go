//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"context"

	"github.com/google/wire"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/server/wireext"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
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

// Initialize the standalone APIServer factory
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(StandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
}

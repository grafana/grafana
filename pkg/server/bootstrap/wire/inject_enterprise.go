//go:build wireinject && (enterprise || pro)
// +build wireinject
// +build enterprise pro

// Enterprise Wire injectors for the full Grafana server. Core provider sets
// live in sets.go; edition bindings live in the overlaid
// wireexts_enterprise.go. Mirrors inject.go on the OSS side.
package wire

import (
	"context"

	"github.com/google/wire"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

func Initialize(ctx context.Context, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
	wire.Build(wireExtsSet)
	return &server.Server{}, nil
}

func InitializeForTest(ctx context.Context, t sqlutil.ITestDB, testingT interface {
	mock.TestingT
	Cleanup(func())
}, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions,
) (*server.TestEnv, error) {
	wire.Build(wireExtsTestSet)
	return &server.TestEnv{Server: &server.Server{}, TestingT: testingT, SQLStore: &sqlstore.SQLStore{}, Cfg: &setting.Cfg{}}, nil
}

func InitializeForCLI(ctx context.Context, cfg *setting.Cfg) (server.Runner, error) {
	wire.Build(wireExtsCLISet)
	return server.Runner{}, nil
}

// InitializeAPIServerFactory initializes the standalone APIServer factory.
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(wireExtsStandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
}

//go:build !enterprise && !pro
// +build !enterprise,!pro

package server

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

// This file provides the OSS versions of Initialize, InitializeForTest,
// InitializeForCLI and InitializeAPIServerFactory (build tag !enterprise && !pro).
// In an Enterprise build the generated enterprise_wire_gen.go provides those same
// functions instead.
//
// The generated OSS code that actually builds the server lives in
// pkg/server/bootstrap/wire, not here. That package imports pkg/server (its sets
// call server.New and server.NewRunner), so pkg/server can't import it back. To
// get around that, pkg/server/bootstrap/wire hands its build functions to us
// through RegisterInitializers when it loads, and the functions below just call
// whatever was handed in. For that to happen the program has to import
// pkg/server/bootstrap/wire (main, grafana-cli, and testinfra do, with a blank _
// import); otherwise these variables are nil.
//
// See docs/design/ge-standalone/unify-wire-core-sets.md for the plan to remove
// this by moving server.New and server.NewRunner into their own package.
type (
	initializeFn        func(context.Context, *setting.Cfg, Options, api.ServerOptions) (*Server, error)
	initializeForTestFn func(context.Context, sqlutil.ITestDB, interface {
		mock.TestingT
		Cleanup(func())
	}, *setting.Cfg, Options, api.ServerOptions) (*TestEnv, error)
	initializeForCLIFn           func(context.Context, *setting.Cfg) (Runner, error)
	initializeAPIServerFactoryFn func() (standalone.APIServerFactory, error)
)

var (
	initializeServer               initializeFn
	initializeForTestServer        initializeForTestFn
	initializeForCLIServer         initializeForCLIFn
	initializeAPIServerFactoryFunc initializeAPIServerFactoryFn
)

// RegisterInitializers wires OSS dependency-injection entrypoints implemented in
// pkg/server/bootstrap/wire without creating an import cycle.
func RegisterInitializers(
	initialize initializeFn,
	initializeForTest initializeForTestFn,
	initializeForCLI initializeForCLIFn,
	initializeAPIServerFactory initializeAPIServerFactoryFn,
) {
	initializeServer = initialize
	initializeForTestServer = initializeForTest
	initializeForCLIServer = initializeForCLI
	initializeAPIServerFactoryFunc = initializeAPIServerFactory
}

func Initialize(ctx context.Context, cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*Server, error) {
	return initializeServer(ctx, cfg, opts, apiOpts)
}

func InitializeForTest(ctx context.Context, t sqlutil.ITestDB, testingT interface {
	mock.TestingT
	Cleanup(func())
}, cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions,
) (*TestEnv, error) {
	return initializeForTestServer(ctx, t, testingT, cfg, opts, apiOpts)
}

func InitializeForCLI(ctx context.Context, cfg *setting.Cfg) (Runner, error) {
	return initializeForCLIServer(ctx, cfg)
}

func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	return initializeAPIServerFactoryFunc()
}

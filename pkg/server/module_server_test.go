package server

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type moduleRegistererFunc func(modules.Registry)

func (f moduleRegistererFunc) RegisterModules(registry modules.Registry) {
	f(registry)
}

func TestModuleServerRunWaitsForModulesToStopDuringStartup(t *testing.T) {
	const (
		fastModuleName = "test-fast-shutdown-module"
		slowModuleName = "test-slow-startup-module"
	)

	fastRunning := make(chan struct{})
	slowStarted := make(chan struct{})
	stopping := make(chan struct{})
	releaseStopping := make(chan struct{})

	cfg := setting.NewCfg()
	cfg.Target = []string{fastModuleName, slowModuleName}
	ms, err := InitializeModuleServer(cfg, Options{}, api.ServerOptions{})
	require.NoError(t, err)

	ms.moduleRegisterer = moduleRegistererFunc(func(registry modules.Registry) {
		registry.RegisterModule(fastModuleName, func() (services.Service, error) {
			return services.NewBasicService(
				nil,
				func(ctx context.Context) error {
					close(fastRunning)
					<-ctx.Done()
					return nil
				},
				func(error) error {
					close(stopping)
					<-releaseStopping
					return nil
				},
			).WithName(fastModuleName), nil
		})
		registry.RegisterModule(slowModuleName, func() (services.Service, error) {
			return services.NewBasicService(
				func(ctx context.Context) error {
					close(slowStarted)
					<-ctx.Done()
					return ctx.Err()
				},
				nil,
				nil,
			).WithName(slowModuleName), nil
		})
	})

	runErr := make(chan error, 1)
	go func() {
		runErr <- ms.Run()
	}()

	select {
	case <-fastRunning:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for fast module to run")
	}
	select {
	case <-slowStarted:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for slow module startup")
	}

	shutdownErr := make(chan error, 1)
	go func() {
		shutdownErr <- ms.Shutdown(context.Background(), "test shutdown")
	}()

	select {
	case <-stopping:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for module stopping")
	}

	select {
	case err := <-runErr:
		t.Fatalf("module server returned before module stopping completed: %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	close(releaseStopping)

	select {
	case err := <-runErr:
		require.Error(t, err)
		require.ErrorContains(t, err, context.Canceled.Error())
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for module server to stop")
	}

	require.NoError(t, <-shutdownErr)
}

func TestIntegrationWillRunInstrumentationServerWhenTargetHasNoHttpServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("sqlite is not supported by the storage server target")
	}

	_, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	cfg.HTTPPort = "3001"
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = "localhost:10000"
	cfg.Target = []string{modules.StorageServer}

	ms, err := InitializeModuleServer(cfg, Options{}, api.ServerOptions{})
	require.NoError(t, err)

	errChan := make(chan error, 1)
	go func() {
		time.Sleep(1 * time.Second)
		errChan <- ms.Run()
	}()

	require.Eventually(t, func() bool {
		client := http.Client{
			Timeout: 1 * time.Second,
		}
		res, err := client.Get("http://localhost:3001/metrics")
		if err != nil {
			return false
		}
		defer func() {
			if err := res.Body.Close(); err != nil {
				t.Fatalf("failed to close response body: %v", err)
			}
		}()
		return res.StatusCode == http.StatusOK
	}, 10*time.Second, 1*time.Second)

	err = ms.Shutdown(context.Background(), "test over")
	require.NoError(t, err)

	select {
	case err := <-errChan:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Fatalf("unexpected error from module server: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for module server to shut down")
	}
}

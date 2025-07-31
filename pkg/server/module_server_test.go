package server

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationWillRunInstrumentationServerWhenTargetHasNoHttpServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if db.IsTestDbSQLite() {
		t.Skip("sqlite is not supported by the storage server target")
	}

	_, settingsProvider := db.InitTestDBWithCfg(t)
	cfg := settingsProvider.Get()
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

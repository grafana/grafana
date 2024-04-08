package server

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationWillRunInstrumentationServerWhenTargetHasNoHttpServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dbType := os.Getenv("GRAFANA_TEST_DB")
	if dbType == "" {
		t.Skip("skipping - GRAFANA_TEST_DB not defined")
	}
	if dbType == "sqlite3" {
		t.Skip("skipping - sqlite not supported for storage server target")
	}

	testdb := db.InitTestDB(t)
	cfg := testdb.Cfg
	cfg.GRPCServerNetwork = "tcp"
	cfg.GRPCServerAddress = "localhost:10000"
	addStorageServerToConfig(t, cfg, dbType)
	cfg.Target = []string{modules.StorageServer}

	ms, err := InitializeModuleServer(cfg, Options{}, api.ServerOptions{})
	require.NoError(t, err)

	go func() {
		err = ms.Run()
		if err.Error() != "context canceled" {
			t.Error(err)
		}
	}()
	time.Sleep(2 * time.Second) // wait for http server to be running

	client := http.Client{}
	res, err := client.Get("http://localhost:3000/metrics")
	require.NoError(t, err)
	err = res.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	err = ms.Shutdown(context.Background(), "test over")
	require.NoError(t, err)
}

func addStorageServerToConfig(t *testing.T, cfg *setting.Cfg, dbType string) {
	s, err := cfg.Raw.NewSection("entity_api")
	require.NoError(t, err)
	_, err = s.NewKey("db_type", dbType)
	require.NoError(t, err)

	if dbType == "postgres" {
		_, _ = s.NewKey("db_host", "localhost")
		_, _ = s.NewKey("db_name", "grafanatest")
		_, _ = s.NewKey("db_user", "grafanatest")
		_, _ = s.NewKey("db_pass", "grafanatest")
	} else {
		_, _ = s.NewKey("db_host", "localhost")
		_, _ = s.NewKey("db_name", "grafana_ds_tests")
		_, _ = s.NewKey("db_user", "root")
		_, _ = s.NewKey("db_pass", "rootpass")
	}
}

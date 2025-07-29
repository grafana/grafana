package server

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"cuelang.org/go/pkg/regexp"
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
	// TODO - fix this test for postgres
	if dbType == "postgres" {
		t.Skip("skipping - test not working with postgres in Drone. Works locally.")
	}

	// Skip during CI migration - MySQL service connectivity issues in enterprise CI environment
	t.Skip("Skipping during CI migration - MySQL service unavailable in enterprise CI environment (dial tcp 127.0.0.1:3306: connection refused)")

	_, cfg := db.InitTestDBWithCfg(t)
	cfg.HTTPPort = "3001"
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = "localhost:10000"
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
	time.Sleep(500 * time.Millisecond) // wait for http server to be running

	client := http.Client{}
	res, err := client.Get("http://localhost:3001/metrics")
	require.NoError(t, err)
	err = res.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	err = ms.Shutdown(context.Background(), "test over")
	require.NoError(t, err)
}

func addStorageServerToConfig(t *testing.T, cfg *setting.Cfg, dbType string) {
	s, err := cfg.Raw.NewSection("resource_api")
	require.NoError(t, err)
	_, err = s.NewKey("db_type", dbType)
	require.NoError(t, err)

	if dbType == "postgres" {
		_, _ = s.NewKey("db_host", "localhost")
		_, _ = s.NewKey("db_name", "grafanatest")
		_, _ = s.NewKey("db_user", "grafanatest")
		_, _ = s.NewKey("db_pass", "grafanatest")
	} else {
		// cant use localhost as hostname in drone tests for mysql, so need to parse it from connection string
		sec, err := cfg.Raw.GetSection("database")
		require.NoError(t, err)
		connString := sec.Key("connection_string").String()
		matches, err := regexp.FindSubmatch("(.+):(.+)@tcp\\((.+):(\\d+)\\)/(.+)\\?", connString)
		require.NoError(t, err)
		_, _ = s.NewKey("db_host", matches[3])
		_, _ = s.NewKey("db_name", matches[5])
		_, _ = s.NewKey("db_user", matches[1])
		_, _ = s.NewKey("db_pass", matches[2])
	}
}

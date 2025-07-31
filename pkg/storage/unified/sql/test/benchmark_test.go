package test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/tests"
)

func newTestBackend(b testing.TB) resource.StorageBackend {
	dbstore := db.InitTestDB(b)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
	require.NoError(b, err)
	require.NotNil(b, eDB)

	backend, err := sql.NewBackend(sql.BackendOptions{
		DBProvider:              eDB,
		IsHA:                    true,
		SimulatedNetworkLatency: 2 * time.Millisecond, // to simulate some network latency
	})
	require.NoError(b, err)
	require.NotNil(b, backend)
	err = backend.Init(context.Background())
	require.NoError(b, err)
	return backend
}

func TestIntegrationBenchmarkSQLStorageBackend(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests.SkipIntegrationTestInShortMode(t)
	opts := test.DefaultBenchmarkOptions()
	if db.IsTestDbSQLite() {
		opts.Concurrency = 1 // to avoid SQLite database is locked error
	}
	test.BenchmarkStorageBackend(t, newTestBackend(t), opts)
}

func TestIntegrationBenchmarkResourceServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	opts := &test.BenchmarkOptions{
		NumResources:     1000,
		Concurrency:      10,
		NumNamespaces:    1,
		NumGroups:        1,
		NumResourceTypes: 1,
	}
	tempDir := t.TempDir()
	t.Cleanup(func() {
		_ = os.RemoveAll(tempDir)
	})
	// Create a new bleve backend
	search, err := search.NewBleveBackend(search.BleveOptions{
		Root: tempDir,
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering), nil)
	require.NoError(t, err)
	require.NotNil(t, search)

	// Create a new resource backend
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	storage, err := sql.NewBackend(sql.BackendOptions{
		DBProvider: eDB,
		IsHA:       false,
	})
	require.NoError(t, err)
	require.NotNil(t, storage)

	err = storage.Init(ctx)
	require.NoError(t, err)

	test.BenchmarkIndexServer(t, ctx, storage, search, opts)
}

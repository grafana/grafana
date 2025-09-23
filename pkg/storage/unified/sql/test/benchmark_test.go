package test

import (
	"context"
	"testing"
	"time"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/stretchr/testify/require"
)

func newTestBackend(b *testing.B) resource.StorageBackend {
	dbstore := infraDB.InitTestDB(b)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(b, err)
	require.NotNil(b, eDB)

	backend, err := sql.NewBackend(sql.BackendOptions{
		DBProvider:              eDB,
		IsHA:                    true,
		SimulatedNetworkLatency: 5 * time.Millisecond, // to simulate some network latency
	})
	require.NoError(b, err)
	require.NotNil(b, backend)
	err = backend.Init(context.Background())
	require.NoError(b, err)
	return backend
}

func BenchmarkSQLStorageBackend(b *testing.B) {
	opts := test.DefaultBenchmarkOptions()
	if infraDB.IsTestDbSQLite() {
		opts.Concurrency = 1 // to avoid SQLite database is locked error
	}
	test.BenchmarkStorageBackend(b, newTestBackend(b), opts)
}

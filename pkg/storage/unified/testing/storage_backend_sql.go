package test

import (
	"context"
	"testing"
	"time"
	"uuid"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

func NewTestSqlKvBackend(t *testing.T, ctx context.Context) (resource.KVBackend, sqldb.DB) {
	t.Helper()
	return NewTestSqlKvBackendWithKV(t, ctx, nil)
}

// NewTestSqlKvBackendWithKV is NewTestSqlKvBackend with its KV passed through
// wrap, when set, so a test can observe or alter what storage asks the KV for.
func NewTestSqlKvBackendWithKV(t *testing.T, ctx context.Context, wrap func(resource.KV) resource.KV) (resource.KVBackend, sqldb.DB) {
	t.Helper()

	dbstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)
	store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)
	if wrap != nil {
		store = wrap(store)
	}

	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore:            store,
		DBKeepAlive:        eDB,
		Holder:             "test-holder-" + uuid.NewV4().String(),
		SearchLookback:     time.Second,
		UseChannelNotifier: dbConn.DriverName() == "sqlite3",
		// keep it low in tests as most of them don't exercise concurrent writes
		WatchOptions: resource.WatchOptions{SettleDelay: time.Millisecond},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, backend.Stop(context.Background()))
	})
	return backend, dbConn
}

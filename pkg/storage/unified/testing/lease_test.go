package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLeaseBadger(t *testing.T) {
	t.Skip("not implemented yet")
	testutil.SkipIntegrationTestInShortMode(t)

	RunLeaseTest(t, func(ctx context.Context) resource.KV {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)

		t.Cleanup(func() {
			require.NoError(t, db.Close())
		})

		return kv.NewBadgerKV(db)
	})
}

func TestIntegrationLeaseSQLKV(t *testing.T) {
	t.Skip("not implemented yet")
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	RunLeaseTest(t, func(ctx context.Context) resource.KV {
		dbstore := db.InitTestDB(t)
		eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
		require.NoError(t, err)
		dbConn, err := eDB.Init(ctx)
		require.NoError(t, err)
		store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
		require.NoError(t, err)
		return store
	})
}

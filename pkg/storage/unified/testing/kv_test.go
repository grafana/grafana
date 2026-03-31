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
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestBadgerKV(t *testing.T) {
	RunKVTest(t, func(ctx context.Context) resource.KV {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := db.Close()
			require.NoError(t, err)
		})

		return resource.NewBadgerKV(db)
	}, &KVTestOptions{
		NSPrefix: "badger-kv-test",
	})
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestSQLKV(t *testing.T) {
	RunKVTest(t, func(ctx context.Context) resource.KV {
		dbstore := db.InitTestDB(t)
		eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
		require.NoError(t, err)
		dbConn, err := eDB.Init(ctx)
		require.NoError(t, err)
		kv, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
		require.NoError(t, err)
		return kv
	}, &KVTestOptions{
		NSPrefix: "sql-kv-test",
	})
}

func TestSQLKVBatchWithExternalTxRollsBackOnFailure(t *testing.T) {
	ctx := context.Background()

	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)

	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)

	store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	tx, err := dbConn.SqlDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = tx.Rollback()
	})

	txCtx := kv.ContextWithDBTX(ctx, tx)
	err = store.Batch(txCtx, kv.EventsSection, []resource.BatchOp{
		{Mode: kv.BatchOpPut, Key: "rolled-back-put", Value: []byte("value")},
		{Mode: kv.BatchOpUpdate, Key: "missing-key", Value: []byte("should-fail")},
	})
	require.ErrorIs(t, err, resource.ErrNotFound)

	require.NoError(t, tx.Commit())

	_, err = store.Get(ctx, kv.EventsSection, "rolled-back-put")
	require.ErrorIs(t, err, resource.ErrNotFound)
}

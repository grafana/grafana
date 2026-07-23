package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLeaseBadger(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	bdb, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, bdb.Close()) })

	RunLeaseTest(t, kv.NewBadgerKV(bdb))
}

func TestIntegrationLeaseSQLKV(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(context.Background())
	require.NoError(t, err)
	store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	RunLeaseTest(t, store)
}

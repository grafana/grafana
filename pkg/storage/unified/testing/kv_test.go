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
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	bdb, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, bdb.Close()) })

	RunKVTest(t, resource.NewBadgerKV(bdb), &KVTestOptions{NSPrefix: "badger-kv-test"})
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestSQLKV(t *testing.T) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(context.Background())
	require.NoError(t, err)
	sqlKV, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	RunKVTest(t, sqlKV, &KVTestOptions{NSPrefix: "sql-kv-test"})
}

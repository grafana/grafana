package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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

		kv, err := resource.NewSQLKV(eDB)
		require.NoError(t, err)
		return kv
	}, &KVTestOptions{
		NSPrefix: "sql-kv-test",
		SkipTests: map[string]bool{
			TestKVSave:          true,
			TestKVConcurrent:    true,
			TestKVUnixTimestamp: true,
			TestKVBatchGet:      true,
			TestKVBatchDelete:   true,
		},
	})
}

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

type bulkTestItem struct {
	ID    int64
	Value string `xorm:"varchar(10)"`
}

func TestBatching(t *testing.T) {
	t.Run("InBatches", func(t *testing.T) {
		t.Run("calls fn 0 times if items is empty", func(t *testing.T) {
			var calls int
			fn := func(batch any) error { calls += 1; return nil }
			opts := BulkOpSettings{BatchSize: DefaultBatchSize}

			err := InBatches([]int{}, opts, fn)

			require.NoError(t, err)
			require.Zero(t, calls)
		})

		t.Run("succeeds if batch size is nonpositive", func(t *testing.T) {
			var calls int
			fn := func(batch any) error { calls += 1; return nil }
			opts := BulkOpSettings{BatchSize: DefaultBatchSize}

			err := InBatches([]int{1, 2, 3}, opts, fn)

			require.NoError(t, err)
			require.Equal(t, 1, calls)
		})

		t.Run("rejects if items is not a slice", func(t *testing.T) {
			var calls int
			fn := func(batch any) error { calls += 1; return nil }
			opts := BulkOpSettings{BatchSize: DefaultBatchSize}

			err := InBatches("lol", opts, fn)

			require.Error(t, err)
		})

		t.Run("calls expected number of times when batch size does not evenly divide length", func(t *testing.T) {
			var calls int
			fn := func(batch any) error { calls += 1; return nil }
			opts := BulkOpSettings{BatchSize: 5}
			vals := make([]int, 93)

			err := InBatches(vals, opts, fn)

			require.NoError(t, err)
			require.Equal(t, 19, calls)
		})
	})
}

func TestIntegrationBulkOps(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db, _ := InitTestDB(t)
	err := db.engine.Sync(new(bulkTestItem))
	require.NoError(t, err)

	t.Run("insert several records", func(t *testing.T) {
		vals := make([]bulkTestItem, 45)
		opts := NativeSettingsForDialect(db.GetDialect())
		opts.BatchSize = 10

		var inserted int64
		err := db.WithDbSession(context.Background(), func(sess *DBSession) error {
			ins, err := sess.BulkInsert(bulkTestItem{}, vals, opts)
			inserted = ins
			return err
		})

		require.NoError(t, err)
		require.Equal(t, int64(45), inserted)
		assertTableCount(t, db, bulkTestItem{}, 45)
	})
}

func assertTableCount(t *testing.T, db *SQLStore, table any, expCount int64) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *DBSession) error {
		total, err := sess.Table(bulkTestItem{}).Count()
		require.Equal(t, expCount, total)
		return err
	})
	require.NoError(t, err)
}

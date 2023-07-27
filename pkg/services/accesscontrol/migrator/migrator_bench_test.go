package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

func benchScopeSplitV1(b *testing.B, count int) {
	store := db.InitTestDB(b)
	// Populate permissions
	require.NoError(b, batchInsertPermissions(count, store), "could not insert permissions")
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplitV1(store, logger)
		require.NoError(b, err)
	}
}

func benchScopeSplitBatch(b *testing.B, count int) {
	store := db.InitTestDB(b)
	// Populate permissions
	require.NoError(b, batchInsertPermissions(count, store), "could not insert permissions")
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplitBatch(store, logger)
		require.NoError(b, err)
	}
}

func benchScopeSplitConcurrent(b *testing.B, count int) {
	store := db.InitTestDB(b)
	// Populate permissions
	require.NoError(b, batchInsertPermissions(count, store), "could not insert permissions")
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplit(store, logger)
		require.NoError(b, err)
	}
}

func BenchmarkMigrateScopeSplitV1_50K(b *testing.B) { benchScopeSplitV1(b, 50000) }

func BenchmarkMigrateScopeSplitV1_100K(b *testing.B) { benchScopeSplitV1(b, 100000) }

func BenchmarkMigrateScopeSplitBatch_50K(b *testing.B) { benchScopeSplitBatch(b, 50000) }

func BenchmarkMigrateScopeSplitBatch_100K(b *testing.B) { benchScopeSplitBatch(b, 100000) }

// Prev migration time:    pg: 9.00 s/op mysql8: 11.3 s/op
// Concurrent batch time:  pg: 0.11 s/op mysql8: 2.2 s/op
// Batch only time:        pg: 2.63 s/op mysql8: 7.00 s/op
func BenchmarkMigrateScopeSplitConcurrent_50K(b *testing.B) { benchScopeSplitConcurrent(b, 50000) }

// Prev migration time:    pg: 18.5s/op, mysql8: 20.2s/op
// Concurrent batch time:  pg: 1.90s/op, mysql8: 4.4s/op
func BenchmarkMigrateScopeSplitConcurrent_100K(b *testing.B) { benchScopeSplitConcurrent(b, 100000) }

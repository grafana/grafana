package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

func benchScopeSplit(b *testing.B, count int) {
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

// Prev migration time:    pg: 9.00 s/op mysql8: 11.3 s/op
// Concurrent batch time:  pg: 0.11 s/op mysql8: 2.2 s/op
// Batch only time:        pg: 2.63 s/op mysql8: 7.00 s/op
func BenchmarkMigrateScopeSplit_50K(b *testing.B) { benchScopeSplit(b, 50000) }

// Prev migration time:    pg: 18.5s/op, mysql8: 20.2s/op
// Concurrent batch time:  pg: 1.90s/op, mysql8: 4.4s/op
func BenchmarkMigrateScopeSplit_100K(b *testing.B) { benchScopeSplit(b, 100000) }

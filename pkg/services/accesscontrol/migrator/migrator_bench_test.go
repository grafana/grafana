package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

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

func BenchmarkMigrateScopeSplitConcurrent_50K(b *testing.B) { benchScopeSplitConcurrent(b, 50000) }

func BenchmarkMigrateScopeSplitConcurrent_100K(b *testing.B) { benchScopeSplitConcurrent(b, 100000) }

package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func benchScopeSplit(b *testing.B, count int) {
	store := setupPermissions(b, count)
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplit(store, logger)
		require.NoError(b, err)
	}
}

func benchScopeSplitV2(b *testing.B, count int) {
	store := setupPermissions(b, count)
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplitV2(store, logger)
		require.NoError(b, err)
	}
}

func benchScopeSplitV3(b *testing.B, count int) {
	store := setupPermissions(b, count)
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplitV3(store, logger)
		require.NoError(b, err)
	}
}

func BenchmarkMigrateScopeSplit_1K(b *testing.B) { benchScopeSplit(b, 1000) }

func BenchmarkMigrateScopeSplit_50K(b *testing.B)   { benchScopeSplit(b, 50000) }   // pg: 9.0 s/op mysql: 11.3 s/op
func BenchmarkMigrateScopeSplitV2_50K(b *testing.B) { benchScopeSplitV2(b, 50000) } // pg: 0.11 s/op mysql: 2.2 s/op
func BenchmarkMigrateScopeSplitV3_50K(b *testing.B) { benchScopeSplitV3(b, 50000) } // pg:  21.0 s/op mysql: 154s/op

func BenchmarkMigrateScopeSplit_100K(b *testing.B)   { benchScopeSplit(b, 100000) }   // pg: ~18.5s/op, mysql8: ~20.2s/op
func BenchmarkMigrateScopeSplitV2_100K(b *testing.B) { benchScopeSplitV2(b, 100000) } // pg: ~1.9s/op, mysql8: ~4.4s/op

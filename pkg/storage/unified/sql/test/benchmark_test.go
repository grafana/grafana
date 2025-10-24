package test

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationBenchmarkSQLStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	opts := test.DefaultBenchmarkOptions()
	if db.IsTestDbSQLite() {
		opts.Concurrency = 1 // to avoid SQLite database is locked error
	}
	test.BenchmarkStorageBackend(t, newTestBackend(t, true, 2*time.Millisecond), opts)
}

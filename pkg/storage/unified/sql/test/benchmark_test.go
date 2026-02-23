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
	opts := test.DefaultBenchmarkOptions(t)
	if db.IsTestDbSQLite() {
		opts.Concurrency = 1 // to avoid SQLite database is locked error
	}
	backend := newTestBackend(t, true, 2*time.Millisecond, min(max(10, opts.Concurrency), 100))
	test.RunStorageBackendBenchmark(t, backend, opts)
}

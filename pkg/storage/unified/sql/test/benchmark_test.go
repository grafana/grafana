package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
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

func TestIntegrationBenchmarkSQLStorageAndSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	opts := test.DefaultBenchmarkOptions(t)
	if db.IsTestDbSQLite() {
		opts.Concurrency = 1
	}
	backend := newTestBackend(t, true, 2*time.Millisecond, min(max(10, opts.Concurrency), 100))
	searchBackend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                   t.TempDir(),
		FileThreshold:          0,
		IndexMinUpdateInterval: opts.IndexMinUpdateInterval,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(searchBackend.Stop)
	groupsResources := make(map[string]string, opts.NumResourceTypes)
	for i := 0; i < opts.NumResourceTypes; i++ {
		groupsResources[fmt.Sprintf("group-%d", i)] = fmt.Sprintf("resource-%d", i)
	}
	searchOpts := resource.SearchOptions{
		Backend: searchBackend,
		Resources: &resource.TestDocumentBuilderSupplier{
			GroupsResources: groupsResources,
		},
	}
	test.RunStorageAndSearchBenchmark(t, backend, searchOpts, opts)
}

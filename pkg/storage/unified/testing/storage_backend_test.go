package test

import (
	"context"
	"fmt"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestBadgerKVStorageBackend(t *testing.T) {
	RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = db.Close()
		})
		kvOpts := resource.KVBackendOptions{
			KvStore: resource.NewBadgerKV(db),
		}
		backend, err := resource.NewKVStorageBackend(kvOpts)
		require.NoError(t, err)
		return backend
	}, &TestOptions{
		NSPrefix: "badgerkvstorage-test",
		SkipTests: map[string]bool{
			// TODO: fix these tests and remove this skip
			TestBlobSupport: true,
		},
	})
}

func TestIntegrationBenchmarkSQLKVStorageBackend(t *testing.T) {
	for _, withRvManager := range []bool{true, false} {
		t.Run(fmt.Sprintf("rvmanager=%t", withRvManager), func(t *testing.T) {
			testutil.SkipIntegrationTestInShortMode(t)

			opts := DefaultBenchmarkOptions(t)
			if db.IsTestDbSQLite() {
				opts.Concurrency = 1 // to avoid SQLite database is locked error
			}
			backend, dbConn := NewTestSqlKvBackend(t, t.Context(), withRvManager)
			dbConn.SqlDB().SetMaxOpenConns(min(max(10, opts.Concurrency), 100))
			RunStorageBackendBenchmark(t, backend, opts)
		})
	}
}

func TestIntegrationBenchmarkSQLKVStorageAndSearch(t *testing.T) {
	for _, withRvManager := range []bool{true, false} {
		t.Run(fmt.Sprintf("rvmanager=%t", withRvManager), func(t *testing.T) {
			t.Skip("skipping until https://github.com/grafana/search-and-storage-team/issues/659 is fixed")
			testutil.SkipIntegrationTestInShortMode(t)
			opts := DefaultBenchmarkOptions(t)
			if db.IsTestDbSQLite() {
				opts.Concurrency = 1
			}
			backend, _ := NewTestSqlKvBackend(t, t.Context(), withRvManager)
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
			RunStorageAndSearchBenchmark(t, backend, searchOpts, opts)
		})
	}
}

func TestIntegrationSQLKVStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	skipTests := map[string]bool{
		TestBlobSupport: true,
	}

	t.Run("Without RvManager", func(t *testing.T) {
		RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := NewTestSqlKvBackend(t, ctx, false)
			return backend
		}, &TestOptions{
			NSPrefix:  "sqlkvstoragetest",
			SkipTests: skipTests,
		})
	})

	t.Run("With RvManager", func(t *testing.T) {
		RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := NewTestSqlKvBackend(t, ctx, true)
			return backend
		}, &TestOptions{
			NSPrefix:  "sqlkvstoragetest-rvmanager",
			SkipTests: skipTests,
		})
	})
}

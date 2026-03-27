package test

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupBadgerKV(t *testing.T) resource.StorageBackend {
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = db.Close()
	})
	kvOpts := resource.KVBackendOptions{
		KvStore: resource.NewBadgerKV(db),
		// keep it low in tests as most of them don't exercise concurrent writes
		WatchOptions: resource.WatchOptions{SettleDelay: time.Millisecond},
	}
	backend, err := resource.NewKVStorageBackend(kvOpts)
	require.NoError(t, err)
	return backend
}

func TestBadgerKVStorageBackend(t *testing.T) {
	RunStorageBackendTest(t, func(_ context.Context) resource.StorageBackend {
		return setupBadgerKV(t)
	}, &TestOptions{
		NSPrefix: "badgerkvstorage-test",
		SkipTests: map[string]bool{
			// TODO: fix these tests and remove this skip
			TestBlobSupport: true,
		},
	})
}

func TestBadgerKVConcurrentCreateNoAlreadyExists(t *testing.T) {
	runConcurrentCreateNoAlreadyExists(t, setupBadgerKV(t), "badgerkv-no-already-exists")
}

func TestIntegrationSQLKVConcurrentCreateNoAlreadyExists(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("Without RvManager", func(t *testing.T) {
		backend, _ := NewTestSqlKvBackend(t, t.Context(), false)
		runConcurrentCreateNoAlreadyExists(t, backend, "sqlkv-no-already-exists")
	})

	t.Run("With RvManager", func(t *testing.T) {
		backend, _ := NewTestSqlKvBackend(t, t.Context(), true)
		runConcurrentCreateNoAlreadyExists(t, backend, "sqlkv-rvmanager-no-already-exists")
	})
}

func runConcurrentCreateNoAlreadyExists(t *testing.T, backend resource.StorageBackend, ns string) {
	ctx := t.Context()

	// Launch 10 concurrent creates for the same resource name.
	const numConcurrent = 10
	type result struct {
		rv  int64
		err error
	}
	results := make([]result, numConcurrent)

	var wg sync.WaitGroup
	for i := range numConcurrent {
		wg.Go(func() {
			rv, writeErr := WriteEvent(ctx, backend, "concurrent-create-item", resourcepb.WatchEvent_ADDED,
				WithNamespace(ns),
				WithValue(fmt.Sprintf("create-%d", i)))
			results[i] = result{rv: rv, err: writeErr}
		})
	}
	wg.Wait()

	var successes int
	var errs []error
	for _, res := range results {
		if res.err == nil {
			successes++
		} else {
			errs = append(errs, res.err)
		}
	}

	require.LessOrEqual(t, successes, 1, "at most one create should succeed")

	// When no resource was actually created, the errors should not claim it
	// already exists — that would be a false positive from optimistic
	// concurrency control.
	if successes == 0 {
		for _, e := range errs {
			require.NotErrorIs(t, e, resource.ErrResourceAlreadyExists,
				"should not receive ErrResourceAlreadyExists when no resource is created")
		}
	}
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
			testutil.SkipIntegrationTestInShortMode(t)
			opts := DefaultBenchmarkOptions(t)
			if db.IsTestDbSQLite() {
				t.Skip("concurrency benchmark skipped with sqlite")
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
				IndexModificationCacheTTL: 5 * time.Minute,
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

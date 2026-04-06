package test

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
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
	createErrors := make([]error, numConcurrent)

	var wg sync.WaitGroup
	var successes atomic.Int64
	var resourceRV atomic.Int64
	for i := range numConcurrent {
		wg.Go(func() {
			rv, writeErr := WriteEvent(ctx, backend, "concurrent-create-item", resourcepb.WatchEvent_ADDED,
				WithNamespace(ns),
				WithValue(fmt.Sprintf("create-%d", i)))
			createErrors[i] = writeErr
			if writeErr == nil {
				successes.Add(1)
				resourceRV.Store(rv)
			}
		})
	}
	wg.Wait()

	require.LessOrEqual(t, successes.Load(), int64(1), "at most one create should succeed")

	// When no resource was actually created, the errors should not claim it
	// already exists.
	if successes.Load() == 0 {
		for _, e := range createErrors {
			require.NotErrorIs(t, e, resource.ErrResourceAlreadyExists,
				"should not receive ErrResourceAlreadyExists when no resource is created")
		}
	}

	// If the resource hasn't been created, do it now.
	if successes.Load() == 0 {
		rv, err := WriteEvent(ctx, backend, "concurrent-create-item", resourcepb.WatchEvent_ADDED,
			WithNamespace(ns),
			WithValue("value"))
		require.NoError(t, err)
		resourceRV.Store(rv)
	}

	// Now, check that from now on, every attempt to create will get an `AlreadyExists` error,
	// even if performed concurrently with other actions
	for i := range numConcurrent {
		wg.Go(func() {
			_, writeErr := WriteEvent(ctx, backend, "concurrent-create-item", resourcepb.WatchEvent_ADDED,
				WithNamespace(ns),
				WithValue(fmt.Sprintf("create-%d", i)))
			createErrors[i] = writeErr
		})
		wg.Go(func() {
			rv, updateErr := WriteEvent(ctx, backend, "concurrent-create-item", resourcepb.WatchEvent_MODIFIED,
				WithNamespaceAndRV(ns, resourceRV.Load()),
				WithValue(fmt.Sprintf("create-%d", i)))
			if updateErr == nil {
				resourceRV.Store(rv)
			}
		})
	}
	wg.Wait()

	// All creates should have received `AlreadyExists`
	for _, e := range createErrors {
		require.Error(t, e, "all creates should have failed")
		require.ErrorIs(t, e, resource.ErrResourceAlreadyExists,
			"should receive ErrResourceAlreadyExists after resource is created")
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

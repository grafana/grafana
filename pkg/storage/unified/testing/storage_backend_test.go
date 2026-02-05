package test

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

func TestConcurrentUpdates(t *testing.T) {
	const concurrency = 30
	sqlkv, dbConn := NewTestSqlKvBackend(t, t.Context(), true)
	dbConn.SqlDB().SetMaxOpenConns(concurrency)

	// Create contended resource
	const namespace = "namespace"
	const group = "group"
	const resourceType = "dashboard"
	const name = "r1"

	runAttempt := func(attempt int, previousRV int64) int64 {
		g, groupCtx := errgroup.WithContext(t.Context())
		newRV := previousRV
		var mu sync.Mutex

		for tid := range concurrency {
			g.Go(func() error {
				updateRV, err := WriteEvent(groupCtx, sqlkv, name, resourcepb.WatchEvent_MODIFIED,
					WithNamespaceAndRV(namespace, previousRV),
					WithGroup(group),
					WithResource(resourceType),
					WithValue(fmt.Sprintf("123-%d", concurrency*attempt+tid)),
				)

				// optmistic locking errors are expected
				if err != nil {
					if strings.Contains(err.Error(), "optimistic locking failed") {
					}
				}

				mu.Lock()
				newRV = max(newRV, updateRV)
				mu.Unlock()

				return nil
			})
		}

		// Wait for all workers to complete
		require.NoError(t, g.Wait())
		return newRV
	}

	checkConsistency := func(t *testing.T) (string, int64, string, int) {
		const resourceQuery = `SELECT guid, resource_version, value FROM resource WHERE namespace = ? AND ` + "`group`" + ` = ? AND resource = ? AND name = ?`

		var resourceGUID string
		var resourceVersion int64
		var resourceValue string
		err := dbConn.QueryRowContext(
			t.Context(), resourceQuery, namespace, group, resourceType, name,
		).Scan(&resourceGUID, &resourceVersion, &resourceValue)
		require.NoError(t, err)

		const historyQuery = `SELECT guid, resource_version, value FROM resource_history WHERE namespace = ? AND ` + "`group`" + ` = ? AND resource = ? AND name = ? ORDER BY resource_version ASC`

		type historyRow struct {
			GUID    string
			Version int64
			Value   string
		}

		var historyRows []historyRow
		rows, err := dbConn.QueryContext(
			t.Context(), historyQuery, namespace, group, resourceType, name,
		)
		require.NoError(t, err)

		for rows.Next() {
			var record historyRow
			require.NoError(t, rows.Scan(&record.GUID, &record.Version, &record.Value))
			historyRows = append(historyRows, record)
		}
		require.NoError(t, rows.Err())

		// Ensure what's in the resource table is the same as the latest entry in resource_history
		last := historyRows[len(historyRows)-1]

		if last.GUID != resourceGUID || last.Version != resourceVersion || last.Value != resourceValue {
			msg := fmt.Sprintf("MISMATCH!\n\nresource:\n{%q, %d, %q}\n\n", resourceGUID, resourceVersion, resourceValue)

			msg += "resource_history:\n"
			for _, h := range historyRows {
				msg += fmt.Sprintf("{%q, %d, %q}\n", h.GUID, h.Version, h.Value)
			}

			require.FailNow(t, msg)
		}

		return resourceGUID, resourceVersion, resourceValue, len(historyRows)
	}

	resourceRV, err := WriteEvent(t.Context(), sqlkv, name, resourcepb.WatchEvent_ADDED,
		WithNamespace(namespace),
		WithGroup(group),
		WithResource(resourceType),
		WithValue("abc"))
	require.NoError(t, err)

	const maxAttempts = 100

	for j := range maxAttempts {
		t.Logf("Attempt %d", j+1)
		resourceRV = runAttempt(j, resourceRV)
		checkConsistency(t)
	}

	guid, version, value, history := checkConsistency(t)
	t.Logf("GUID=%q | Version=%d | Value=%q | History=%d", guid, version, value, history)
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

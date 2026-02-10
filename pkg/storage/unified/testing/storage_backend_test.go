package test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math/rand"
	"strings"
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

func TestConcurrentWrites(t *testing.T) {
	const concurrency = 5
	sqlkv, dbConn := NewTestSqlKvBackend(t, t.Context(), true)
	dbConn.SqlDB().SetMaxOpenConns(concurrency)

	const namespace = "namespace"
	const group = "group"
	const resourceType = "dashboard"
	const name = "r1"

	runAttempt := func(attempt int) {
		getEvent := func(tid int, previousRV int64) (resourcepb.WatchEvent_Type, []WriteEventOption) {
			action := rand.Intn(3)
			var eventType resourcepb.WatchEvent_Type
			options := []WriteEventOption{
				WithNamespaceAndRV(namespace, previousRV),
				WithGroup(group),
				WithResource(resourceType),
			}

			switch action {
			case 0: // create
				// t.Logf("t%d: ADDED", tid)
				eventType = resourcepb.WatchEvent_ADDED
				options = append(options, WithValue("abc"))
			case 1: // update
				// t.Logf("t%d: MODIFIED", tid)
				eventType = resourcepb.WatchEvent_MODIFIED
				options = append(options, WithValue(fmt.Sprintf("123-%d", tid)))
			case 2: // delete
				// t.Logf("t%d: DELETED", tid)
				eventType = resourcepb.WatchEvent_DELETED
			}

			return eventType, options
		}

		name := fmt.Sprintf("%s_%d", name, attempt)

		// Create contended resource
		initialRV, err := WriteEvent(t.Context(), sqlkv, name, resourcepb.WatchEvent_ADDED,
			WithNamespace(namespace),
			WithGroup(group),
			WithResource(resourceType),
			WithValue(fmt.Sprintf("initial_%s", name)),
		)
		require.NoError(t, err)

		g, groupCtx := errgroup.WithContext(t.Context())

		for tid := range concurrency {
			g.Go(func() error {
				eventType, options := getEvent(tid, initialRV)
				_, err := WriteEvent(groupCtx, sqlkv, name, eventType, options...)

				// optmistic locking errors are expected
				if err != nil {
					if strings.Contains(err.Error(), "optimistic locking failed") {
						return nil
					}

					if eventType == resourcepb.WatchEvent_ADDED && strings.Contains(err.Error(), "resource already exists") {
						return nil
					}

					return fmt.Errorf("%v: %w", eventType, err)
				}

				return nil
			})
		}

		// Wait for all workers to complete
		require.NoError(t, g.Wait())
	}

	checkConsistency := func(t *testing.T, attempt int) (string, int64, string, int) {
		name := fmt.Sprintf("%s_%d", name, attempt)

		const resourceQuery = `SELECT guid, resource_version, value FROM resource WHERE namespace = ? AND ` + "`group`" + ` = ? AND resource = ? AND name = ?`

		var resourceGUID string
		var resourceVersion int64
		var resourceValue string
		err := dbConn.QueryRowContext(
			t.Context(), resourceQuery, namespace, group, resourceType, name,
		).Scan(&resourceGUID, &resourceVersion, &resourceValue)
		hasResource := true

		if errors.Is(err, sql.ErrNoRows) {
			hasResource = false
		} else {
			require.NoError(t, err)
		}
		resourceValue = strings.TrimSpace(resourceValue)

		const historyQuery = `SELECT guid, resource_version, action, value, key_path FROM resource_history WHERE namespace = ? AND ` + "`group`" + ` = ? AND resource = ? AND name = ? ORDER BY resource_version ASC`

		type historyRow struct {
			GUID    string
			Version int64
			Action  int64
			Value   string
			KeyPath string
		}

		var historyRows []historyRow
		rows, err := dbConn.QueryContext(
			t.Context(), historyQuery, namespace, group, resourceType, name,
		)
		require.NoError(t, err)

		for rows.Next() {
			var record historyRow
			require.NoError(t, rows.Scan(&record.GUID, &record.Version, &record.Action, &record.Value, &record.KeyPath))
			record.Value = strings.TrimSpace(record.Value)
			historyRows = append(historyRows, record)
		}
		require.NoError(t, rows.Err())

		// Ensure what's in the resource table is the same as the latest entry in resource_history
		if hasResource {
			if len(historyRows) > 0 {
				last := historyRows[len(historyRows)-1]

				if last.GUID != resourceGUID || last.Version != resourceVersion || last.Value != resourceValue {
					var different []string
					if last.GUID != resourceGUID {
						different = append(different, "guid")
					}
					if last.Version != resourceVersion {
						different = append(different, "version")
					}
					if last.Value != resourceValue {
						different = append(different, "value")
					}
					msg := fmt.Sprintf("MISMATCH (%v)!\n\nresource:\n{%s, %d, %s}\n\n", different, resourceGUID, resourceVersion, resourceValue)

					msg += "resource_history:\n"
					for _, h := range historyRows {
						msg += fmt.Sprintf("{%s, %d, %d, %s, %s}\n", h.GUID, h.Version, h.Action, h.Value, h.KeyPath)
					}

					require.FailNow(t, msg)
				}
			} else {
				msg := fmt.Sprintf("MISMATCH!\n\nresource:\n{%s, %d, %s}\n\n", resourceGUID, resourceVersion, resourceValue)

				msg += "resource_history:\nNO ROWS\n"
				require.FailNow(t, msg)
			}
		} else {
			if len(historyRows) > 0 {
				last := historyRows[len(historyRows)-1]

				if last.Action != 3 {
					msg := "MISMATCH!\n\nresource:\nNO ROWS\n\n"

					msg += "resource_history:\n"
					for _, h := range historyRows {
						msg += fmt.Sprintf("{%s, %d, %d, %s, %s}\n", h.GUID, h.Version, h.Action, h.Value, h.KeyPath)
					}

					require.FailNow(t, msg)
				}
			}
		}

		return resourceGUID, resourceVersion, resourceValue, len(historyRows)
	}

	const maxAttempts = 100

	for j := range maxAttempts {
		t.Logf("Attempt %d", j+1)
		runAttempt(j)
		checkConsistency(t, j)
	}

	guid, version, value, history := checkConsistency(t, maxAttempts-1)
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

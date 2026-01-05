package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
			TestBlobSupport:       true,
			TestListModifiedSince: true,
			// Badger does not support bulk import yet.
			TestGetResourceLastImportTime: true,
		},
	})
}

func TestSQLKVStorageBackend(t *testing.T) {
	RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
		backend, _ := NewTestSqlKvBackend(t, ctx)
		return backend
	}, &TestOptions{
		NSPrefix: "sqlkvstorage-test",
		SkipTests: map[string]bool{
			TestHappyPath:                 true,
			TestWatchWriteEvents:          true,
			TestList:                      true,
			TestBlobSupport:               true,
			TestGetResourceStats:          true,
			TestListHistory:               true,
			TestListHistoryErrorReporting: true,
			TestListModifiedSince:         true,
			TestListTrash:                 true,
			TestCreateNewResource:         true,
			TestGetResourceLastImportTime: true,
			TestOptimisticLocking:         true,
			TestKeyPathGeneration:         true,
		},
	})
}

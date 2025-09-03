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
		backend, err := resource.NewKvStorageBackend(resource.NewBadgerKV(db))
		require.NoError(t, err)
		return backend
	}, &TestOptions{
		NSPrefix: "kvstorage-test",
		SkipTests: map[string]bool{
			// TODO: fix these tests and remove this skip
			TestBlobSupport:       true,
			TestListModifiedSince: true,
		},
	})
}

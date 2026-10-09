package service

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	storagekv "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

type testStorageBackend struct {
	resource.KVBackend
	kv              storagekv.KV
	lastImportStore testLastImportStore
}

type testLastImportStore struct{ kv storagekv.KV }

func (s testLastImportStore) Save(ctx context.Context, value resourcecontract.ResourceLastImportTime) error {
	key := resource.LastImportTimeKey{
		Namespace: value.Namespace, Group: value.Group, Resource: value.Resource, LastImportTime: value.LastImportTime,
	}
	if err := key.Validate(); err != nil {
		return err
	}
	writer, err := s.kv.Save(ctx, storagekv.LastImportTimeSection, key.String())
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte{1}); err != nil {
		return err
	}
	return writer.Close()
}

func setupTestStorageBackend(t *testing.T, configs ...func(*resource.KVBackendOptions)) *testStorageBackend {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	store := storagekv.NewBadgerKV(db)
	opts := resource.KVBackendOptions{
		KvStore: store, WatchOptions: resource.WatchOptions{SettleDelay: time.Millisecond},
	}
	for _, configure := range configs {
		configure(&opts)
	}
	backend, err := resource.NewKVStorageBackend(opts)
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		require.NoError(t, backend.Stop(ctx))
	})
	return &testStorageBackend{KVBackend: backend, kv: store, lastImportStore: testLastImportStore{kv: store}}
}

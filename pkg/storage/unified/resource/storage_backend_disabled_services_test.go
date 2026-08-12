package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// stopBackend stops the goroutines building a backend starts, which goleak
// otherwise reports.
func stopBackend(t *testing.T, b StorageBackend) {
	t.Helper()
	if kvb, ok := b.(*kvStorageBackend); ok {
		t.Cleanup(func() { _ = kvb.Stop(context.Background()) })
	}
}

// Collection refuses a zero interval, so a backend that starts it with one fails
// to build. That makes "did it start" observable without waiting on a loop.
func TestKVStorageBackendDisableStorageServices(t *testing.T) {
	gc := GarbageCollectionConfig{Enabled: true, Interval: 0, MaxAge: time.Hour}

	t.Run("starts collection when storage services are enabled", func(t *testing.T) {
		_, err := NewKVStorageBackend(KVBackendOptions{
			KvStore:           setupBadgerKV(t),
			GarbageCollection: gc,
			// Construction fails here, so there is no backend to stop and the
			// pruner would be left running.
			DisablePruner: true,
		})
		require.ErrorContains(t, err, "garbage collection")
	})

	t.Run("does not start collection when storage services are disabled", func(t *testing.T) {
		backend, err := NewKVStorageBackend(KVBackendOptions{
			KvStore:                setupBadgerKV(t),
			GarbageCollection:      gc,
			DisableStorageServices: true,
		})
		require.NoError(t, err)
		require.NotNil(t, backend)
		stopBackend(t, backend)
	})

	// Writes add to the pruner without checking whether it exists.
	t.Run("the pruner is present but does nothing", func(t *testing.T) {
		backend, err := NewKVStorageBackend(KVBackendOptions{
			KvStore:                setupBadgerKV(t),
			DisableStorageServices: true,
		})
		require.NoError(t, err)
		stopBackend(t, backend)
		kvb, ok := backend.(*kvStorageBackend)
		require.True(t, ok)
		require.NotNil(t, kvb.historyPruner)
		require.IsType(t, &NoopPruner{}, kvb.historyPruner)
	})
}

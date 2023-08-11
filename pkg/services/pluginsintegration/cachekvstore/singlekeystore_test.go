package cachekvstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/stretchr/testify/require"
)

func TestSingleKeyNamespacedStore(t *testing.T) {
	const (
		namespace = "namespace"
		key       = "key"
		value     = "value"
	)

	kv := kvstore.NewFakeKVStore()
	store := NewSingleKeyNamespacedStore(kv, namespace, key)

	t.Run("set stores one key and updates last updated time", func(t *testing.T) {
		ts, err := store.GetLastUpdated(context.Background())
		require.NoError(t, err)
		require.Zero(t, ts)

		require.NoError(t, store.Set(context.Background(), value))
		ts, err = store.GetLastUpdated(context.Background())
		require.NoError(t, err)
		require.WithinDuration(t, time.Now(), ts, time.Second*10)

		// Check underlying storage
		storedValue, ok, err := kv.Get(context.Background(), 0, namespace, key)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, value, storedValue)
	})

	t.Run("get returns the stored value", func(t *testing.T) {
		require.NoError(t, store.Set(context.Background(), value))
		v, ok, err := store.Get(context.Background())
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, value, v)
	})

	t.Run("delete deletes the stored value", func(t *testing.T) {
		require.NoError(t, store.Set(context.Background(), value))

		_, ok, err := store.Get(context.Background())
		require.NoError(t, err)
		require.True(t, ok)

		require.NoError(t, store.Delete(context.Background()))
		_, ok, err = store.Get(context.Background())
		require.NoError(t, err)
		require.False(t, ok)
	})
}

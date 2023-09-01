package cachekvstore

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

func TestNamespacedStore(t *testing.T) {
	const namespace = "namespace"

	t.Run("simple", func(t *testing.T) {
		store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)

		t.Run("default last updated time is zero", func(t *testing.T) {
			ts, err := store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, ts)
		})

		t.Run("Get returns false if key does not exist", func(t *testing.T) {
			_, ok, err := store.Get(context.Background(), "key")
			require.NoError(t, err)
			require.False(t, ok)
		})

		t.Run("Set sets the value and updates the last updated time", func(t *testing.T) {
			ts, err := store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, ts)

			require.NoError(t, store.Set(context.Background(), "key", "value"))
			ts, err = store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.NotZero(t, ts)
			require.WithinDuration(t, ts, time.Now(), time.Second*10)

			v, ok, err := store.Get(context.Background(), "key")
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, "value", v)
		})

		t.Run("Delete deletes the value", func(t *testing.T) {
			// First store
			require.NoError(t, store.Set(context.Background(), "key", "value"))

			// Then read it
			v, ok, err := store.Get(context.Background(), "key")
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, "value", v)

			// Delete it
			require.NoError(t, store.Delete(context.Background(), "key"))

			// Read it again
			_, ok, err = store.Get(context.Background(), "key")
			require.NoError(t, err)
			require.False(t, ok)
		})

		t.Run("sets last updated on delete", func(t *testing.T) {
			store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)
			ts, err := store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, ts)

			require.NoError(t, store.Delete(context.Background(), "key"))

			ts, err = store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.WithinDuration(t, time.Now(), ts, time.Second*10)
		})

		t.Run("last updated key is used in GetLastUpdated", func(t *testing.T) {
			store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)

			// Set in underlying store
			ts := time.Now()
			require.NoError(t, store.kv.Set(context.Background(), keyLastUpdated, ts.Format(time.RFC3339)))

			// Make sure we get the same value
			storeTs, err := store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			// Format to account for marshal/unmarshal differences
			require.Equal(t, ts.Format(time.RFC3339), storeTs.Format(time.RFC3339))
		})

		t.Run("last updated key is used in SetLastUpdated", func(t *testing.T) {
			store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)
			require.NoError(t, store.SetLastUpdated(context.Background()))

			marshaledStoreTs, ok, err := store.kv.Get(context.Background(), keyLastUpdated)
			require.NoError(t, err)
			require.True(t, ok)
			storeTs, err := time.Parse(time.RFC3339, marshaledStoreTs)
			require.NoError(t, err)
			require.WithinDuration(t, time.Now(), storeTs, time.Second*10)
		})

		t.Run("ListKeys", func(t *testing.T) {
			t.Run("returns empty list if no keys", func(t *testing.T) {
				keys, err := store.ListKeys(context.Background())
				require.NoError(t, err)
				require.Empty(t, keys)
			})

			t.Run("returns the keys", func(t *testing.T) {
				expectedKeys := make([]string, 0, 10)
				for i := 0; i < 10; i++ {
					k := fmt.Sprintf("key-%d", i)
					err := store.Set(context.Background(), k, fmt.Sprintf("value-%d", i))
					expectedKeys = append(expectedKeys, k)
					require.NoError(t, err)
				}

				keys, err := store.ListKeys(context.Background())
				require.NoError(t, err)

				sort.Strings(expectedKeys)
				sort.Strings(keys)

				require.Equal(t, expectedKeys, keys)
			})
		})
	})

	t.Run("prefix", func(t *testing.T) {
		t.Run("no prefix", func(t *testing.T) {
			store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)
			require.Equal(t, "k", store.storeKey("k"))
		})

		t.Run("prefix", func(t *testing.T) {
			store := NewNamespacedStoreWithPrefix(kvstore.NewFakeKVStore(), namespace, "my-")
			require.Equal(t, "my-k", store.storeKey("k"))
		})
	})
}

func TestMarshal(t *testing.T) {
	t.Run("json", func(t *testing.T) {
		// Other type (rather than string, []byte or fmt.Stringer) marshals to JSON.
		var value struct {
			A string `json:"a"`
			B string `json:"b"`
		}
		expV, err := json.Marshal(value)
		require.NoError(t, err)

		v, err := marshal(value)
		require.NoError(t, err)
		require.Equal(t, string(expV), v)
	})

	t.Run("string", func(t *testing.T) {
		v, err := marshal("value")
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})

	t.Run("stringer", func(t *testing.T) {
		var s stringer
		v, err := marshal(s)
		require.NoError(t, err)
		require.Equal(t, s.String(), v)
	})

	t.Run("byte slice", func(t *testing.T) {
		v, err := marshal([]byte("value"))
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})
}

type stringer struct{}

func (s stringer) String() string {
	return "aaaa"
}

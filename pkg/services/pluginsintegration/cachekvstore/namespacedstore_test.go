package cachekvstore

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

func TestDefaultStoreKeyGetter(t *testing.T) {
	t.Run("returns the key", func(t *testing.T) {
		require.Equal(t, "key", DefaultStoreKeyGetter.GetStoreKey("key"))
	})
}

func TestPrefixStoreKeyGetter(t *testing.T) {
	t.Run("adds the specified prefix", func(t *testing.T) {
		require.Equal(t, "prefix-key", PrefixStoreKeyGetter("prefix-").GetStoreKey("key"))
	})

	t.Run("empty prefix returns the initial key", func(t *testing.T) {
		require.Equal(t, "key", PrefixStoreKeyGetter("").GetStoreKey("key"))
	})
}

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

	t.Run("options", func(t *testing.T) {
		t.Run("store key getter", func(t *testing.T) {
			mockKeyGetter := newMockStoreKeyGetter(DefaultStoreKeyGetter)
			store := NewNamespacedStore(
				kvstore.NewFakeKVStore(), namespace,
				WithStoreKeyGetter(mockKeyGetter),
			)

			t.Run("default store key getter is used when not provided", func(t *testing.T) {
				store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)
				// (testify can't compare functions, so compare their pointers)
				require.Equal(
					t,
					reflect.ValueOf(DefaultStoreKeyGetter).Pointer(),
					reflect.ValueOf(store.storeKeyGetter).Pointer(),
				)
			})

			t.Run("Get uses the store key getter", func(t *testing.T) {
				_, _, err := store.Get(context.Background(), "key")
				require.NoError(t, err)
				require.True(t, mockKeyGetter.called())
			})

			t.Run("Set uses the store key getter", func(t *testing.T) {
				require.NoError(t, store.Set(context.Background(), "key", "value"))
				require.True(t, mockKeyGetter.called())
			})

			t.Run("Delete uses the store key getter", func(t *testing.T) {
				require.NoError(t, store.Delete(context.Background(), "key"))
				require.True(t, mockKeyGetter.called())
			})

			t.Run("ListKeys uses the store key getter", func(t *testing.T) {
				_, err := store.ListKeys(context.Background())
				require.NoError(t, err)
				require.True(t, mockKeyGetter.lastCalledWith(""))
			})
		})

		t.Run("setLastUpdatedOnDelete", func(t *testing.T) {
			t.Run("defaults to true", func(t *testing.T) {
				store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace)
				require.True(t, store.setLastUpdatedOnDelete)
			})

			t.Run("sets last updated on delete if true", func(t *testing.T) {
				store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace, WithSetLastUpdatedOnDelete(true))
				ts, err := store.GetLastUpdated(context.Background())
				require.NoError(t, err)
				require.Zero(t, ts)

				require.NoError(t, store.Delete(context.Background(), "key"))

				ts, err = store.GetLastUpdated(context.Background())
				require.NoError(t, err)
				require.WithinDuration(t, time.Now(), ts, time.Second*10)
			})

			t.Run("does not set last updated on delete if false", func(t *testing.T) {
				store := NewNamespacedStore(kvstore.NewFakeKVStore(), namespace, WithSetLastUpdatedOnDelete(false))
				ts, err := store.GetLastUpdated(context.Background())
				require.NoError(t, err)
				require.Zero(t, ts)

				require.NoError(t, store.Delete(context.Background(), "key"))
				ts, err = store.GetLastUpdated(context.Background())
				require.NoError(t, err)
				require.Zero(t, ts)
			})
		})
	})
}

// mockStoreKeyGetter is a mock implementation of StoreKeyGetter.
// It calls the provided function and keeps track of how many times it was called.
// It also keeps track of the arguments passed to the function.
type mockStoreKeyGetter struct {
	f          StoreKeyGetterFunc
	lastCalled int

	// calls is the number of times the function was called.
	calls int

	// args is a list of the "key" argument passed to the function, for each call.
	// It is reset every time called() is called.
	args []string
}

// newMockStoreKeyGetter returns a new mockStoreKeyGetter that calls the provided function.
func newMockStoreKeyGetter(f StoreKeyGetterFunc) *mockStoreKeyGetter {
	return &mockStoreKeyGetter{f: f}
}

// GetStoreKey calls the provided function and keeps track of how many times it was called.
func (m *mockStoreKeyGetter) GetStoreKey(k string) string {
	m.calls++
	m.args = append(m.args, k)
	return m.f.GetStoreKey(k)
}

// called returns true if the function was called since the last time called() was called.
func (m *mockStoreKeyGetter) called() bool {
	r := m.calls > m.lastCalled
	m.lastCalled = m.calls
	m.args = m.args[:0]
	return r
}

// lastCalledWith returns true if the function was called with the provided key since the last time called() was called.
func (m *mockStoreKeyGetter) lastCalledWith(k string) bool {
	if len(m.args) == 0 {
		return false
	}
	return m.args[len(m.args)-1] == k
}

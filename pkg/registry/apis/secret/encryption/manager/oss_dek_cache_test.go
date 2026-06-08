package manager

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOSSDataKeyCache(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour, // avoid expiration for testing
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace := "test-namespace"
	entry := encryption.DataKeyCacheEntry{
		Namespace:        namespace,
		Id:               "key-123",
		Label:            "2024-01-01@provider.key1",
		EncryptedDataKey: []byte("test-data-key"),
		Active:           true,
	}

	t.Run("Set and GetById and GetByLabel", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace, entry))

		retrieved, exists, err := cache.GetById(ctx, namespace, entry.Id)
		require.NoError(t, err)
		require.True(t, exists, "entry should exist after adding")
		assert.Equal(t, entry.Id, retrieved.Id)
		assert.Equal(t, entry.Label, retrieved.Label)
		assert.Equal(t, entry.EncryptedDataKey, retrieved.EncryptedDataKey)
		assert.Equal(t, entry.Active, retrieved.Active)
		assert.Equal(t, namespace, retrieved.Namespace)
		assert.True(t, retrieved.Expiration.After(time.Now()), "expiration should be in the future")

		retrieved, exists, err = cache.GetByLabel(ctx, namespace, entry.Label)
		require.NoError(t, err)
		require.True(t, exists, "entry should exist after adding")
		assert.Equal(t, entry.Id, retrieved.Id)
		assert.Equal(t, entry.Label, retrieved.Label)
		assert.Equal(t, entry.EncryptedDataKey, retrieved.EncryptedDataKey)
		assert.Equal(t, entry.Active, retrieved.Active)
		assert.Equal(t, namespace, retrieved.Namespace)
		assert.True(t, retrieved.Expiration.After(time.Now()), "expiration should be in the future")
	})
}

func TestOSSDataKeyCache_FalseConditions(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace := "test-namespace"
	entry := encryption.DataKeyCacheEntry{
		Namespace:        namespace,
		Id:               "key-123",
		Label:            "2024-01-01@provider.key1",
		EncryptedDataKey: []byte("test-data-key"),
		Active:           true,
	}

	t.Run("GetById and GetByLabel return false for non-existent namespace", func(t *testing.T) {
		_, exists, err := cache.GetById(ctx, "non-existent-namespace", "any-id")
		require.NoError(t, err)
		assert.False(t, exists)

		_, exists, err = cache.GetByLabel(ctx, "non-existent-namespace", "any-label")
		require.NoError(t, err)
		assert.False(t, exists)
	})

	t.Run("GetById and GetByLabel return false for non-existent id/label", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace, entry))

		_, exists, err := cache.GetById(ctx, namespace, "non-existent-id")
		require.NoError(t, err)
		assert.False(t, exists)

		_, exists, err = cache.GetByLabel(ctx, namespace, "non-existent-label")
		require.NoError(t, err)
		assert.False(t, exists)
	})

	t.Run("GetById and GetByLabel return false for expired entry", func(t *testing.T) {
		shortTTLSettings := setting.NewCfg()
		shortTTLSettings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 1 * time.Millisecond,
		}
		shortCache := ProvideOSSDataKeyCache(shortTTLSettings)

		namespace := "test-ns"
		expiredEntry := encryption.DataKeyCacheEntry{
			Namespace:        namespace,
			Id:               "expired-key",
			Label:            "expired-label",
			EncryptedDataKey: []byte("expired-data"),
		}
		require.NoError(t, shortCache.Set(ctx, namespace, expiredEntry))

		time.Sleep(10 * time.Millisecond)

		_, exists, err := shortCache.GetById(ctx, namespace, expiredEntry.Id)
		require.NoError(t, err)
		assert.False(t, exists, "should return false for expired entry")

		_, exists, err = shortCache.GetByLabel(ctx, namespace, expiredEntry.Label)
		require.NoError(t, err)
		assert.False(t, exists, "should return false for expired entry")
	})

	t.Run("GetById and GetByLabel return false when entry namespace doesn't match", func(t *testing.T) {
		testCache := ProvideOSSDataKeyCache(settings).(*ossDataKeyCache)

		mismatchedEntry := encryption.DataKeyCacheEntry{
			Id:               "test-id",
			Label:            "test-label",
			EncryptedDataKey: []byte("test-data"),
			Namespace:        "wrong-namespace",
			Expiration:       time.Now().Add(999 * time.Hour),
		}

		testCache.mtx.Lock()
		testCache.byId[namespacedKey{namespace: "correct-namespace", value: mismatchedEntry.Id}] = mismatchedEntry
		testCache.byLabel[namespacedKey{namespace: "correct-namespace", value: mismatchedEntry.Label}] = mismatchedEntry
		testCache.mtx.Unlock()

		_, exists, err := testCache.GetById(ctx, "correct-namespace", mismatchedEntry.Id)
		require.ErrorIs(t, err, encryption.ErrDataKeyCacheUnexpectedNamespace)
		assert.False(t, exists)

		_, exists, err = testCache.GetByLabel(ctx, "correct-namespace", mismatchedEntry.Label)
		require.ErrorIs(t, err, encryption.ErrDataKeyCacheUnexpectedNamespace)
		assert.False(t, exists)
	})
}

// Test namespace isolation
func TestOSSDataKeyCache_NamespaceIsolation(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace1 := "namespace-1"
	namespace2 := "namespace-2"

	entry1 := encryption.DataKeyCacheEntry{
		Namespace:        namespace1,
		Id:               "shared-id",
		Label:            "shared-label",
		EncryptedDataKey: []byte("data-from-ns1"),
		Active:           true,
	}

	entry2 := encryption.DataKeyCacheEntry{
		Namespace:        namespace2,
		Id:               "shared-id",
		Label:            "shared-label",
		EncryptedDataKey: []byte("data-from-ns2"),
		Active:           false,
	}

	t.Run("entries with same ID and label in different namespaces are isolated", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace1, entry1))
		require.NoError(t, cache.Set(ctx, namespace2, entry2))

		retrieved1, exists, err := cache.GetById(ctx, namespace1, entry1.Id)
		require.NoError(t, err)
		require.True(t, exists)
		assert.Equal(t, entry1.EncryptedDataKey, retrieved1.EncryptedDataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists, err := cache.GetById(ctx, namespace2, entry2.Id)
		require.NoError(t, err)
		require.True(t, exists)
		assert.Equal(t, entry2.EncryptedDataKey, retrieved2.EncryptedDataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)

		retrieved1, exists, err = cache.GetByLabel(ctx, namespace1, entry1.Label)
		require.NoError(t, err)
		require.True(t, exists)
		assert.Equal(t, entry1.EncryptedDataKey, retrieved1.EncryptedDataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists, err = cache.GetByLabel(ctx, namespace2, entry2.Label)
		require.NoError(t, err)
		require.True(t, exists)
		assert.Equal(t, entry2.EncryptedDataKey, retrieved2.EncryptedDataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)
	})

	t.Run("cannot retrieve entry from wrong namespace", func(t *testing.T) {
		// flush both namespaces since the cache is full of stuff now
		cache.Flush(ctx, namespace1)
		cache.Flush(ctx, namespace2)

		require.NoError(t, cache.Set(ctx, namespace1, entry1))

		_, exists, err := cache.GetById(ctx, namespace2, entry1.Id)
		require.NoError(t, err)
		assert.False(t, exists, "should not find entry from different namespace")

		_, exists, err = cache.GetByLabel(ctx, namespace2, entry1.Label)
		require.NoError(t, err)
		assert.False(t, exists, "should not find entry from different namespace")
	})
}

func TestOSSDataKeyCache_Expiration(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	t.Run("entries expire after TTL", func(t *testing.T) {
		settings := setting.NewCfg()
		settings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 50 * time.Millisecond,
		}
		cache := ProvideOSSDataKeyCache(settings)

		namespace := "test-ns"
		entry := encryption.DataKeyCacheEntry{
			Namespace:        namespace,
			Id:               "expiring-key",
			Label:            "expiring-label",
			EncryptedDataKey: []byte("expiring-data"),
		}

		require.NoError(t, cache.Set(ctx, namespace, entry))

		// Should exist immediately
		_, exists, err := cache.GetById(ctx, namespace, entry.Id)
		require.NoError(t, err)
		assert.True(t, exists, "entry should exist immediately after adding")

		_, exists, err = cache.GetByLabel(ctx, namespace, entry.Label)
		require.NoError(t, err)
		assert.True(t, exists, "entry should exist immediately after adding")

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Should not exist after expiration
		_, exists, err = cache.GetById(ctx, namespace, entry.Id)
		require.NoError(t, err)
		assert.False(t, exists, "entry should not exist after TTL expires")

		_, exists, err = cache.GetByLabel(ctx, namespace, entry.Label)
		require.NoError(t, err)
		assert.False(t, exists, "entry should not exist after TTL expires")
	})

	t.Run("RemoveExpired removes only expired entries", func(t *testing.T) {
		settings := setting.NewCfg()
		settings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 50 * time.Millisecond,
		}
		cache := ProvideOSSDataKeyCache(settings)

		namespace := "test-ns"

		// Add entry that will expire
		expiredEntry := encryption.DataKeyCacheEntry{
			Namespace:        namespace,
			Id:               "expired-1",
			Label:            "expired-label-1",
			EncryptedDataKey: []byte("expired-data-1"),
		}

		require.NoError(t, cache.Set(ctx, namespace, expiredEntry))

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Add fresh entry
		freshEntry := encryption.DataKeyCacheEntry{
			Namespace:        namespace,
			Id:               "fresh-1",
			Label:            "fresh-label-1",
			EncryptedDataKey: []byte("fresh-data-1"),
		}

		require.NoError(t, cache.Set(ctx, namespace, freshEntry))

		// Before RemoveExpired, expired entries still exist in the map
		// but GetById/GetByLabel return false due to IsExpired() check

		// Call RemoveExpired
		cache.RemoveExpired(ctx)

		// Fresh entry should still exist
		_, exists, err := cache.GetById(ctx, namespace, freshEntry.Id)
		require.NoError(t, err)
		assert.True(t, exists, "fresh entry should still exist after RemoveExpired")

		_, exists, err = cache.GetByLabel(ctx, namespace, freshEntry.Label)
		require.NoError(t, err)
		assert.True(t, exists, "fresh entry should still exist after RemoveExpired")

		// Expired entry should not exist
		ossCache := cache.(*ossDataKeyCache)
		_, exists = ossCache.byId[namespacedKey{namespace: namespace, value: expiredEntry.Id}]
		assert.False(t, exists, "expired entry should not exist after RemoveExpired")

		_, exists = ossCache.byLabel[namespacedKey{namespace: namespace, value: expiredEntry.Label}]
		assert.False(t, exists, "expired entry should not exist after RemoveExpired")
	})

	t.Run("RemoveExpired handles multiple namespaces", func(t *testing.T) {
		settings := setting.NewCfg()
		settings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 50 * time.Millisecond,
		}
		cache := ProvideOSSDataKeyCache(settings)

		ns1 := "namespace-1"
		ns2 := "namespace-2"

		ns1ExpiredEntry := encryption.DataKeyCacheEntry{
			Namespace:        ns1,
			Id:               "expired-key-ns1",
			Label:            "expired-label-ns1",
			EncryptedDataKey: []byte("expired-data"),
		}
		ns2ExpiredEntry := encryption.DataKeyCacheEntry{
			Namespace:        ns2,
			Id:               "expired-key-ns2",
			Label:            "expired-label-ns2",
			EncryptedDataKey: []byte("expired-data"),
		}

		require.NoError(t, cache.Set(ctx, ns1, ns1ExpiredEntry))
		require.NoError(t, cache.Set(ctx, ns2, ns2ExpiredEntry))

		time.Sleep(100 * time.Millisecond)

		ns1FreshEntry := encryption.DataKeyCacheEntry{
			Namespace:        ns1,
			Id:               "fresh-key-ns1",
			Label:            "fresh-label-ns1",
			EncryptedDataKey: []byte("fresh-data-ns1"),
		}
		ns2FreshEntry := encryption.DataKeyCacheEntry{
			Namespace:        ns2,
			Id:               "fresh-key-ns2",
			Label:            "fresh-label-ns2",
			EncryptedDataKey: []byte("fresh-data-ns2"),
		}

		require.NoError(t, cache.Set(ctx, ns1, ns1FreshEntry))
		require.NoError(t, cache.Set(ctx, ns2, ns2FreshEntry))

		cache.RemoveExpired(ctx)

		// Fresh entries in both namespaces should exist
		_, exists, err := cache.GetById(ctx, ns1, ns1FreshEntry.Id)
		require.NoError(t, err)
		assert.True(t, exists)

		_, exists, err = cache.GetByLabel(ctx, ns1, ns1FreshEntry.Label)
		require.NoError(t, err)
		assert.True(t, exists)

		_, exists, err = cache.GetById(ctx, ns2, ns2FreshEntry.Id)
		require.NoError(t, err)
		assert.True(t, exists)

		_, exists, err = cache.GetByLabel(ctx, ns2, ns2FreshEntry.Label)
		require.NoError(t, err)
		assert.True(t, exists)

		// Expired entries in both namespaces should not exist
		ossCache := cache.(*ossDataKeyCache)
		_, exists = ossCache.byId[namespacedKey{namespace: ns1, value: ns1ExpiredEntry.Id}]
		assert.False(t, exists)

		_, exists = ossCache.byId[namespacedKey{namespace: ns2, value: ns2ExpiredEntry.Id}]
		assert.False(t, exists)

		_, exists = ossCache.byLabel[namespacedKey{namespace: ns1, value: ns1ExpiredEntry.Label}]
		assert.False(t, exists)

		_, exists = ossCache.byLabel[namespacedKey{namespace: ns2, value: ns2ExpiredEntry.Label}]
		assert.False(t, exists)
	})
}

// Test Flush()
func TestOSSDataKeyCache_Flush(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace1 := "namespace-1"
	namespace2 := "namespace-2"

	entry1 := encryption.DataKeyCacheEntry{
		Namespace:        namespace1,
		Id:               "key-1",
		Label:            "label-1",
		EncryptedDataKey: []byte("data-1"),
	}

	entry2 := encryption.DataKeyCacheEntry{
		Namespace:        namespace2,
		Id:               "key-2",
		Label:            "label-2",
		EncryptedDataKey: []byte("data-2"),
	}

	t.Run("Flush removes all entries from specified namespace", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace1, entry1))

		// Verify entries exist
		_, exists, err := cache.GetById(ctx, namespace1, entry1.Id)
		require.NoError(t, err)
		require.True(t, exists)

		_, exists, err = cache.GetByLabel(ctx, namespace1, entry1.Label)
		require.NoError(t, err)
		require.True(t, exists)

		// Flush namespace1
		cache.Flush(ctx, namespace1)

		// Entries should no longer exist
		_, exists, err = cache.GetById(ctx, namespace1, entry1.Id)
		require.NoError(t, err)
		assert.False(t, exists, "entry should not exist after flush")

		_, exists, err = cache.GetByLabel(ctx, namespace1, entry1.Label)
		require.NoError(t, err)
		assert.False(t, exists, "entry should not exist after flush")
	})

	t.Run("Flush only affects specified namespace", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace1, entry1))
		require.NoError(t, cache.Set(ctx, namespace2, entry2))

		// Flush only namespace1
		cache.Flush(ctx, namespace1)

		// namespace1 entries should not exist
		_, exists, err := cache.GetById(ctx, namespace1, entry1.Id)
		require.NoError(t, err)
		assert.False(t, exists)

		_, exists, err = cache.GetByLabel(ctx, namespace1, entry1.Label)
		require.NoError(t, err)
		assert.False(t, exists)

		// namespace2 entries should still exist
		_, exists, err = cache.GetById(ctx, namespace2, entry2.Id)
		require.NoError(t, err)
		assert.True(t, exists, "entries in other namespace should not be affected")

		_, exists, err = cache.GetByLabel(ctx, namespace2, entry2.Label)
		require.NoError(t, err)
		assert.True(t, exists, "entries in other namespace should not be affected")
	})

	t.Run("Flush on non-existent namespace does not panic", func(t *testing.T) {
		assert.NotPanics(t, func() {
			cache.Flush(ctx, "non-existent-namespace")
		})
	})

	t.Run("can add entries after flush", func(t *testing.T) {
		require.NoError(t, cache.Set(ctx, namespace1, entry1))
		cache.Flush(ctx, namespace1)

		// Add new entry after flush
		newEntry := encryption.DataKeyCacheEntry{
			Namespace:        namespace1,
			Id:               "new-key",
			Label:            "new-label",
			EncryptedDataKey: []byte("new-data"),
		}
		require.NoError(t, cache.Set(ctx, namespace1, newEntry))

		// New entry should exist
		_, exists, err := cache.GetById(ctx, namespace1, "new-key")
		require.NoError(t, err)
		assert.True(t, exists, "should be able to add entries after flush")

		_, exists, err = cache.GetByLabel(ctx, namespace1, "new-label")
		require.NoError(t, err)
		assert.True(t, exists, "should be able to add entries after flush")
	})
}

func TestOSSDataKeyCache_Set_NamespaceValidation(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)
	namespace := "expected-ns"

	t.Run("missing namespace returns ErrDataKeyCacheUnexpectedNamespace", func(t *testing.T) {
		entry := encryption.DataKeyCacheEntry{
			Id:               "id",
			Label:            "label",
			EncryptedDataKey: []byte("x"),
		}
		err := cache.Set(ctx, namespace, entry)
		require.Error(t, err)
		require.ErrorIs(t, err, encryption.ErrDataKeyCacheUnexpectedNamespace)
	})

	t.Run("mismatched namespace returns ErrDataKeyCacheUnexpectedNamespace", func(t *testing.T) {
		entry := encryption.DataKeyCacheEntry{
			Namespace:        "other-ns",
			Id:               "id",
			Label:            "label",
			EncryptedDataKey: []byte("x"),
		}
		err := cache.Set(ctx, namespace, entry)
		require.Error(t, err)
		require.ErrorIs(t, err, encryption.ErrDataKeyCacheUnexpectedNamespace)
	})
}

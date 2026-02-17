package manager

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOSSDataKeyCache(t *testing.T) {
	t.Parallel()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour, // avoid expiration for testing
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace := "test-namespace"
	entry := encryption.DataKeyCacheEntry{
		Id:               "key-123",
		Label:            "2024-01-01@provider.key1",
		EncryptedDataKey: []byte("test-data-key"),
		Active:           true,
	}

	t.Run("Set and GetById and GetByLabel", func(t *testing.T) {
		cache.Set(namespace, entry)

		retrieved, exists := cache.GetById(namespace, entry.Id)
		require.True(t, exists, "entry should exist after adding")
		assert.Equal(t, entry.Id, retrieved.Id)
		assert.Equal(t, entry.Label, retrieved.Label)
		assert.Equal(t, entry.EncryptedDataKey, retrieved.EncryptedDataKey)
		assert.Equal(t, entry.Active, retrieved.Active)
		assert.Equal(t, namespace, retrieved.Namespace)
		assert.True(t, retrieved.Expiration.After(time.Now()), "expiration should be in the future")

		retrieved, exists = cache.GetByLabel(namespace, entry.Label)
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

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace := "test-namespace"
	entry := encryption.DataKeyCacheEntry{
		Id:               "key-123",
		Label:            "2024-01-01@provider.key1",
		EncryptedDataKey: []byte("test-data-key"),
		Active:           true,
	}

	t.Run("GetById and GetByLabel return false for non-existent namespace", func(t *testing.T) {
		_, exists := cache.GetById("non-existent-namespace", "any-id")
		assert.False(t, exists)

		_, exists = cache.GetByLabel("non-existent-namespace", "any-label")
		assert.False(t, exists)
	})

	t.Run("GetById and GetByLabel return false for non-existent id/label", func(t *testing.T) {
		cache.Set(namespace, entry)

		_, exists := cache.GetById(namespace, "non-existent-id")
		assert.False(t, exists)

		_, exists = cache.GetByLabel(namespace, "non-existent-label")
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
			Id:               "expired-key",
			Label:            "expired-label",
			EncryptedDataKey: []byte("expired-data"),
		}
		shortCache.Set(namespace, expiredEntry)

		time.Sleep(10 * time.Millisecond)

		_, exists := shortCache.GetById(namespace, expiredEntry.Id)
		assert.False(t, exists, "should return false for expired entry")

		_, exists = shortCache.GetByLabel(namespace, expiredEntry.Label)
		assert.False(t, exists, "should return false for expired entry")
	})

	t.Run("GetById and GetByLabel return false when entry namespace doesn't match", func(t *testing.T) {
		// This tests the entry.Namespace != namespace check in GetById/GetByLabel
		// This is a defensive check that shouldn't normally happen if Set works correctly
		testCache := ProvideOSSDataKeyCache(settings).(*ossDataKeyCache)

		// Manually insert an entry with mismatched namespace to test the defensive check
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

		_, exists := testCache.GetById("correct-namespace", mismatchedEntry.Id)
		assert.False(t, exists, "should return false when entry namespace doesn't match lookup namespace")

		_, exists = testCache.GetByLabel("correct-namespace", mismatchedEntry.Label)
		assert.False(t, exists, "should return false when entry namespace doesn't match lookup namespace")
	})
}

// Test namespace isolation
func TestOSSDataKeyCache_NamespaceIsolation(t *testing.T) {
	t.Parallel()

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace1 := "namespace-1"
	namespace2 := "namespace-2"

	entry1 := encryption.DataKeyCacheEntry{
		Id:               "shared-id",
		Label:            "shared-label",
		EncryptedDataKey: []byte("data-from-ns1"),
		Active:           true,
	}

	entry2 := encryption.DataKeyCacheEntry{
		Id:               "shared-id",
		Label:            "shared-label",
		EncryptedDataKey: []byte("data-from-ns2"),
		Active:           false,
	}

	t.Run("entries with same ID and label in different namespaces are isolated", func(t *testing.T) {
		cache.Set(namespace1, entry1)
		cache.Set(namespace2, entry2)

		retrieved1, exists := cache.GetById(namespace1, entry1.Id)
		require.True(t, exists)
		assert.Equal(t, entry1.EncryptedDataKey, retrieved1.EncryptedDataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists := cache.GetById(namespace2, entry2.Id)
		require.True(t, exists)
		assert.Equal(t, entry2.EncryptedDataKey, retrieved2.EncryptedDataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)

		retrieved1, exists = cache.GetByLabel(namespace1, entry1.Label)
		require.True(t, exists)
		assert.Equal(t, entry1.EncryptedDataKey, retrieved1.EncryptedDataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists = cache.GetByLabel(namespace2, entry2.Label)
		require.True(t, exists)
		assert.Equal(t, entry2.EncryptedDataKey, retrieved2.EncryptedDataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)
	})

	t.Run("cannot retrieve entry from wrong namespace", func(t *testing.T) {
		// flush both namespaces since the cache is full of stuff now
		cache.Flush(namespace1)
		cache.Flush(namespace2)

		cache.Set(namespace1, entry1)

		_, exists := cache.GetById(namespace2, entry1.Id)
		assert.False(t, exists, "should not find entry from different namespace")

		_, exists = cache.GetByLabel(namespace2, entry1.Label)
		assert.False(t, exists, "should not find entry from different namespace")
	})
}

func TestOSSDataKeyCache_Expiration(t *testing.T) {
	t.Parallel()
	t.Run("entries expire after TTL", func(t *testing.T) {
		settings := setting.NewCfg()
		settings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 50 * time.Millisecond,
		}
		cache := ProvideOSSDataKeyCache(settings)

		namespace := "test-ns"
		entry := encryption.DataKeyCacheEntry{
			Id:               "expiring-key",
			Label:            "expiring-label",
			EncryptedDataKey: []byte("expiring-data"),
		}

		cache.Set(namespace, entry)

		// Should exist immediately
		_, exists := cache.GetById(namespace, entry.Id)
		assert.True(t, exists, "entry should exist immediately after adding")

		_, exists = cache.GetByLabel(namespace, entry.Label)
		assert.True(t, exists, "entry should exist immediately after adding")

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Should not exist after expiration
		_, exists = cache.GetById(namespace, entry.Id)
		assert.False(t, exists, "entry should not exist after TTL expires")

		_, exists = cache.GetByLabel(namespace, entry.Label)
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
			Id:               "expired-1",
			Label:            "expired-label-1",
			EncryptedDataKey: []byte("expired-data-1"),
		}

		cache.Set(namespace, expiredEntry)

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Add fresh entry
		freshEntry := encryption.DataKeyCacheEntry{
			Id:               "fresh-1",
			Label:            "fresh-label-1",
			EncryptedDataKey: []byte("fresh-data-1"),
		}

		cache.Set(namespace, freshEntry)

		// Before RemoveExpired, expired entries still exist in the map
		// but GetById/GetByLabel return false due to IsExpired() check

		// Call RemoveExpired
		cache.RemoveExpired()

		// Fresh entry should still exist
		_, exists := cache.GetById(namespace, freshEntry.Id)
		assert.True(t, exists, "fresh entry should still exist after RemoveExpired")

		_, exists = cache.GetByLabel(namespace, freshEntry.Label)
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
			Id:               "expired-key-ns1",
			Label:            "expired-label-ns1",
			EncryptedDataKey: []byte("expired-data"),
		}
		ns2ExpiredEntry := encryption.DataKeyCacheEntry{
			Id:               "expired-key-ns2",
			Label:            "expired-label-ns2",
			EncryptedDataKey: []byte("expired-data"),
		}

		cache.Set(ns1, ns1ExpiredEntry)
		cache.Set(ns2, ns2ExpiredEntry)

		time.Sleep(100 * time.Millisecond)

		ns1FreshEntry := encryption.DataKeyCacheEntry{
			Id:               "fresh-key-ns1",
			Label:            "fresh-label-ns1",
			EncryptedDataKey: []byte("fresh-data-ns1"),
		}
		ns2FreshEntry := encryption.DataKeyCacheEntry{
			Id:               "fresh-key-ns2",
			Label:            "fresh-label-ns2",
			EncryptedDataKey: []byte("fresh-data-ns2"),
		}

		cache.Set(ns1, ns1FreshEntry)
		cache.Set(ns2, ns2FreshEntry)

		cache.RemoveExpired()

		// Fresh entries in both namespaces should exist
		_, exists := cache.GetById(ns1, ns1FreshEntry.Id)
		assert.True(t, exists)

		_, exists = cache.GetByLabel(ns1, ns1FreshEntry.Label)
		assert.True(t, exists)

		_, exists = cache.GetById(ns2, ns2FreshEntry.Id)
		assert.True(t, exists)

		_, exists = cache.GetByLabel(ns2, ns2FreshEntry.Label)
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

	settings := setting.NewCfg()
	settings.SecretsManagement = setting.SecretsManagerSettings{
		DataKeysCacheTTL: 999 * time.Hour,
	}
	cache := ProvideOSSDataKeyCache(settings)

	namespace1 := "namespace-1"
	namespace2 := "namespace-2"

	entry1 := encryption.DataKeyCacheEntry{
		Id:               "key-1",
		Label:            "label-1",
		EncryptedDataKey: []byte("data-1"),
	}

	entry2 := encryption.DataKeyCacheEntry{
		Id:               "key-2",
		Label:            "label-2",
		EncryptedDataKey: []byte("data-2"),
	}

	t.Run("Flush removes all entries from specified namespace", func(t *testing.T) {
		cache.Set(namespace1, entry1)

		// Verify entries exist
		_, exists := cache.GetById(namespace1, entry1.Id)
		require.True(t, exists)

		_, exists = cache.GetByLabel(namespace1, entry1.Label)
		require.True(t, exists)

		// Flush namespace1
		cache.Flush(namespace1)

		// Entries should no longer exist
		_, exists = cache.GetById(namespace1, entry1.Id)
		assert.False(t, exists, "entry should not exist after flush")

		_, exists = cache.GetByLabel(namespace1, entry1.Label)
		assert.False(t, exists, "entry should not exist after flush")
	})

	t.Run("Flush only affects specified namespace", func(t *testing.T) {
		cache.Set(namespace1, entry1)
		cache.Set(namespace2, entry2)

		// Flush only namespace1
		cache.Flush(namespace1)

		// namespace1 entries should not exist
		_, exists := cache.GetById(namespace1, entry1.Id)
		assert.False(t, exists)

		_, exists = cache.GetByLabel(namespace1, entry1.Label)
		assert.False(t, exists)

		// namespace2 entries should still exist
		_, exists = cache.GetById(namespace2, entry2.Id)
		assert.True(t, exists, "entries in other namespace should not be affected")

		_, exists = cache.GetByLabel(namespace2, entry2.Label)
		assert.True(t, exists, "entries in other namespace should not be affected")
	})

	t.Run("Flush on non-existent namespace does not panic", func(t *testing.T) {
		assert.NotPanics(t, func() {
			cache.Flush("non-existent-namespace")
		})
	})

	t.Run("can add entries after flush", func(t *testing.T) {
		cache.Set(namespace1, entry1)
		cache.Flush(namespace1)

		// Add new entry after flush
		newEntry := encryption.DataKeyCacheEntry{
			Id:               "new-key",
			Label:            "new-label",
			EncryptedDataKey: []byte("new-data"),
		}
		cache.Set(namespace1, newEntry)

		// New entry should exist
		_, exists := cache.GetById(namespace1, "new-key")
		assert.True(t, exists, "should be able to add entries after flush")

		_, exists = cache.GetByLabel(namespace1, "new-label")
		assert.True(t, exists, "should be able to add entries after flush")
	})
}

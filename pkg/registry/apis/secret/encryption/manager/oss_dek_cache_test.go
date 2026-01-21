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
		Id:      "key-123",
		Label:   "2024-01-01@provider.key1",
		DataKey: []byte("test-data-key"),
		Active:  true,
	}

	t.Run("AddById and GetById", func(t *testing.T) {
		cache.AddById(namespace, entry)

		retrieved, exists := cache.GetById(namespace, entry.Id)
		require.True(t, exists, "entry should exist after adding")
		assert.Equal(t, entry.Id, retrieved.Id)
		assert.Equal(t, entry.Label, retrieved.Label)
		assert.Equal(t, entry.DataKey, retrieved.DataKey)
		assert.Equal(t, entry.Active, retrieved.Active)
		assert.Equal(t, namespace, retrieved.Namespace)
		assert.True(t, retrieved.Expiration.After(time.Now()), "expiration should be in the future")
	})

	t.Run("AddByLabel and GetByLabel", func(t *testing.T) {
		cache.AddByLabel(namespace, entry)

		retrieved, exists := cache.GetByLabel(namespace, entry.Label)
		require.True(t, exists, "entry should exist after adding")
		assert.Equal(t, entry.Id, retrieved.Id)
		assert.Equal(t, entry.Label, retrieved.Label)
		assert.Equal(t, entry.DataKey, retrieved.DataKey)
		assert.Equal(t, entry.Active, retrieved.Active)
		assert.Equal(t, namespace, retrieved.Namespace)
		assert.True(t, retrieved.Expiration.After(time.Now()), "expiration should be in the future")
	})

	t.Run("GetById and GetByLabel are independent", func(t *testing.T) {
		cache2 := ProvideOSSDataKeyCache(settings)
		ns := "independent-test"

		entryById := encryption.DataKeyCacheEntry{
			Id:      "id-only-key",
			Label:   "label1",
			DataKey: []byte("data1"),
		}
		entryByLabel := encryption.DataKeyCacheEntry{
			Id:      "id2",
			Label:   "label-only-key",
			DataKey: []byte("data2"),
		}

		cache2.AddById(ns, entryById)
		cache2.AddByLabel(ns, entryByLabel)

		// Should find by ID
		retrieved, exists := cache2.GetById(ns, entryById.Id)
		require.True(t, exists)
		assert.Equal(t, entryById.Id, retrieved.Id)

		// Should not find by label that wasn't added via AddByLabel
		_, exists = cache2.GetByLabel(ns, entryById.Label)
		assert.False(t, exists)

		// Should find by label
		retrieved, exists = cache2.GetByLabel(ns, entryByLabel.Label)
		require.True(t, exists)
		assert.Equal(t, entryByLabel.Label, retrieved.Label)

		// Should not find by ID that wasn't added via AddById
		_, exists = cache2.GetById(ns, entryByLabel.Id)
		assert.False(t, exists)
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
		Id:      "key-123",
		Label:   "2024-01-01@provider.key1",
		DataKey: []byte("test-data-key"),
		Active:  true,
	}

	t.Run("GetById returns false for non-existent namespace", func(t *testing.T) {
		_, exists := cache.GetById("non-existent-namespace", "any-id")
		assert.False(t, exists)
	})

	t.Run("GetById returns false for non-existent id", func(t *testing.T) {
		cache.AddById(namespace, entry)
		_, exists := cache.GetById(namespace, "non-existent-id")
		assert.False(t, exists)
	})

	t.Run("GetByLabel returns false for non-existent namespace", func(t *testing.T) {
		_, exists := cache.GetByLabel("non-existent-namespace", "any-label")
		assert.False(t, exists)
	})

	t.Run("GetByLabel returns false for non-existent label", func(t *testing.T) {
		cache.AddByLabel(namespace, entry)
		_, exists := cache.GetByLabel(namespace, "non-existent-label")
		assert.False(t, exists)
	})

	t.Run("GetById returns false for expired entry", func(t *testing.T) {
		shortTTLSettings := setting.NewCfg()
		shortTTLSettings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 1 * time.Millisecond,
		}
		shortCache := ProvideOSSDataKeyCache(shortTTLSettings)

		namespace := "test-ns"
		expiredEntry := encryption.DataKeyCacheEntry{
			Id:      "expired-key",
			Label:   "expired-label",
			DataKey: []byte("expired-data"),
		}
		shortCache.AddById(namespace, expiredEntry)

		time.Sleep(10 * time.Millisecond)

		_, exists := shortCache.GetById(namespace, expiredEntry.Id)
		assert.False(t, exists, "should return false for expired entry")
	})

	t.Run("GetByLabel returns false for expired entry", func(t *testing.T) {
		shortTTLSettings := setting.NewCfg()
		shortTTLSettings.SecretsManagement = setting.SecretsManagerSettings{
			DataKeysCacheTTL: 1 * time.Millisecond,
		}
		shortCache := ProvideOSSDataKeyCache(shortTTLSettings)

		namespace := "test-ns"
		expiredEntry := encryption.DataKeyCacheEntry{
			Id:      "expired-key",
			Label:   "expired-label",
			DataKey: []byte("expired-data"),
		}
		shortCache.AddByLabel(namespace, expiredEntry)

		time.Sleep(10 * time.Millisecond)

		_, exists := shortCache.GetByLabel(namespace, expiredEntry.Label)
		assert.False(t, exists, "should return false for expired entry")
	})

	t.Run("GetById returns false when entry namespace doesn't match", func(t *testing.T) {
		// This tests the entry.Namespace != namespace check in GetById
		// This is a defensive check that shouldn't normally happen if AddById works correctly
		testCache := ProvideOSSDataKeyCache(settings).(*ossDataKeyCache)

		// Manually insert an entry with mismatched namespace to test the defensive check
		mismatchedEntry := encryption.DataKeyCacheEntry{
			Id:         "test-id",
			Label:      "test-label",
			DataKey:    []byte("test-data"),
			Namespace:  "wrong-namespace",
			Expiration: time.Now().Add(999 * time.Hour),
		}

		testCache.mtx.Lock()
		testCache.byId["correct-namespace"] = map[string]encryption.DataKeyCacheEntry{
			mismatchedEntry.Id: mismatchedEntry,
		}
		testCache.mtx.Unlock()

		_, exists := testCache.GetById("correct-namespace", mismatchedEntry.Id)
		assert.False(t, exists, "should return false when entry namespace doesn't match lookup namespace")
	})

	t.Run("GetByLabel returns false when entry namespace doesn't match", func(t *testing.T) {
		// This tests the entry.Namespace != namespace check in GetByLabel
		testCache := ProvideOSSDataKeyCache(settings).(*ossDataKeyCache)

		// Manually insert an entry with mismatched namespace to test the defensive check
		mismatchedEntry := encryption.DataKeyCacheEntry{
			Id:         "test-id",
			Label:      "test-label",
			DataKey:    []byte("test-data"),
			Namespace:  "wrong-namespace",
			Expiration: time.Now().Add(999 * time.Hour),
		}

		testCache.mtx.Lock()
		testCache.byLabel["correct-namespace"] = map[string]encryption.DataKeyCacheEntry{
			"test-label": mismatchedEntry,
		}
		testCache.mtx.Unlock()

		_, exists := testCache.GetByLabel("correct-namespace", mismatchedEntry.Label)
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
		Id:      "shared-id",
		Label:   "shared-label",
		DataKey: []byte("data-from-ns1"),
		Active:  true,
	}

	entry2 := encryption.DataKeyCacheEntry{
		Id:      "shared-id",
		Label:   "shared-label",
		DataKey: []byte("data-from-ns2"),
		Active:  false,
	}

	t.Run("entries with same ID in different namespaces are isolated", func(t *testing.T) {
		cache.AddById(namespace1, entry1)
		cache.AddById(namespace2, entry2)

		retrieved1, exists := cache.GetById(namespace1, entry1.Id)
		require.True(t, exists)
		assert.Equal(t, entry1.DataKey, retrieved1.DataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists := cache.GetById(namespace2, entry2.Id)
		require.True(t, exists)
		assert.Equal(t, entry2.DataKey, retrieved2.DataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)
	})

	t.Run("entries with same label in different namespaces are isolated", func(t *testing.T) {
		cache.AddByLabel(namespace1, entry1)
		cache.AddByLabel(namespace2, entry2)

		retrieved1, exists := cache.GetByLabel(namespace1, entry1.Label)
		require.True(t, exists)
		assert.Equal(t, entry1.DataKey, retrieved1.DataKey)
		assert.Equal(t, namespace1, retrieved1.Namespace)
		assert.True(t, retrieved1.Active)

		retrieved2, exists := cache.GetByLabel(namespace2, entry2.Label)
		require.True(t, exists)
		assert.Equal(t, entry2.DataKey, retrieved2.DataKey)
		assert.Equal(t, namespace2, retrieved2.Namespace)
		assert.False(t, retrieved2.Active)
	})

	t.Run("cannot retrieve entry from wrong namespace", func(t *testing.T) {
		// flush both namespaces since the cache is full of stuff now
		cache.Flush(namespace1)
		cache.Flush(namespace2)

		cache.AddById(namespace1, entry1)

		_, exists := cache.GetById(namespace2, entry1.Id)
		assert.False(t, exists, "should not find entry from different namespace")

		cache.AddByLabel(namespace1, entry1)

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
			Id:      "expiring-key",
			Label:   "expiring-label",
			DataKey: []byte("expiring-data"),
		}

		cache.AddById(namespace, entry)
		cache.AddByLabel(namespace, entry)

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

		// Add entries that will expire
		expiredEntry1 := encryption.DataKeyCacheEntry{
			Id:      "expired-1",
			Label:   "expired-label-1",
			DataKey: []byte("expired-data-1"),
		}
		expiredEntry2 := encryption.DataKeyCacheEntry{
			Id:      "expired-2",
			Label:   "expired-label-2",
			DataKey: []byte("expired-data-2"),
		}

		cache.AddById(namespace, expiredEntry1)
		cache.AddByLabel(namespace, expiredEntry2)

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Add fresh entries
		freshEntry1 := encryption.DataKeyCacheEntry{
			Id:      "fresh-1",
			Label:   "fresh-label-1",
			DataKey: []byte("fresh-data-1"),
		}
		freshEntry2 := encryption.DataKeyCacheEntry{
			Id:      "fresh-2",
			Label:   "fresh-label-2",
			DataKey: []byte("fresh-data-2"),
		}

		cache.AddById(namespace, freshEntry1)
		cache.AddByLabel(namespace, freshEntry2)

		// Before RemoveExpired, expired entries still exist in the map
		// but GetById/GetByLabel return false due to IsExpired() check

		// Call RemoveExpired
		cache.RemoveExpired()

		// Fresh entries should still exist
		_, exists := cache.GetById(namespace, freshEntry1.Id)
		assert.True(t, exists, "fresh entry should still exist after RemoveExpired")

		_, exists = cache.GetByLabel(namespace, freshEntry2.Label)
		assert.True(t, exists, "fresh entry should still exist after RemoveExpired")

		// Expired entries should not exist
		ossCache := cache.(*ossDataKeyCache)
		_, exists = ossCache.byId[namespace][expiredEntry1.Id]
		assert.False(t, exists, "expired entry should not exist after RemoveExpired")

		_, exists = ossCache.byLabel[namespace][expiredEntry2.Label]
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
			Id:      "expired-key-ns1",
			Label:   "expired-label-ns1",
			DataKey: []byte("expired-data"),
		}
		ns2ExpiredEntry := encryption.DataKeyCacheEntry{
			Id:      "expired-key-ns2",
			Label:   "expired-label-ns2",
			DataKey: []byte("expired-data"),
		}

		cache.AddById(ns1, ns1ExpiredEntry)
		cache.AddByLabel(ns1, ns1ExpiredEntry)
		cache.AddById(ns2, ns2ExpiredEntry)
		cache.AddByLabel(ns2, ns2ExpiredEntry)

		time.Sleep(100 * time.Millisecond)

		ns1FreshEntry := encryption.DataKeyCacheEntry{
			Id:      "fresh-key-ns1",
			Label:   "fresh-label-ns1",
			DataKey: []byte("fresh-data-ns1"),
		}
		ns2FreshEntry := encryption.DataKeyCacheEntry{
			Id:      "fresh-key-ns2",
			Label:   "fresh-label-ns2",
			DataKey: []byte("fresh-data-ns2"),
		}

		cache.AddById(ns1, ns1FreshEntry)
		cache.AddByLabel(ns1, ns1FreshEntry)
		cache.AddById(ns2, ns2FreshEntry)
		cache.AddByLabel(ns2, ns2FreshEntry)

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
		_, exists = ossCache.byId[ns1][ns1ExpiredEntry.Id]
		assert.False(t, exists)

		_, exists = ossCache.byId[ns2][ns2ExpiredEntry.Id]
		assert.False(t, exists)

		_, exists = ossCache.byLabel[ns1][ns1ExpiredEntry.Label]
		assert.False(t, exists)

		_, exists = ossCache.byLabel[ns2][ns2ExpiredEntry.Label]
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
		Id:      "key-1",
		Label:   "label-1",
		DataKey: []byte("data-1"),
	}

	entry2 := encryption.DataKeyCacheEntry{
		Id:      "key-2",
		Label:   "label-2",
		DataKey: []byte("data-2"),
	}

	t.Run("Flush removes all entries from specified namespace", func(t *testing.T) {
		cache.AddById(namespace1, entry1)
		cache.AddByLabel(namespace1, entry1)

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
		cache.AddById(namespace1, entry1)
		cache.AddByLabel(namespace1, entry1)
		cache.AddById(namespace2, entry2)
		cache.AddByLabel(namespace2, entry2)

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
		cache.AddById(namespace1, entry1)
		cache.Flush(namespace1)

		// Add new entry after flush
		newEntry := encryption.DataKeyCacheEntry{
			Id:      "new-key",
			Label:   "new-label",
			DataKey: []byte("new-data"),
		}
		cache.AddById(namespace1, newEntry)

		// New entry should exist
		_, exists := cache.GetById(namespace1, "new-key")
		assert.True(t, exists, "should be able to add entries after flush")
	})
}

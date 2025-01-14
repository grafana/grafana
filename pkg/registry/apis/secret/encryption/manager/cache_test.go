package manager

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewMTDataKeyCache(t *testing.T) {
	ttl := 5 * time.Minute
	cache := newMTDataKeyCache(ttl)

	assert.NotNil(t, cache)
	assert.Equal(t, ttl, cache.cacheTTL)
	assert.NotNil(t, cache.namespacedCaches)
}

func TestAddAndGetById(t *testing.T) {
	ttl := 5 * time.Minute
	cache := newMTDataKeyCache(ttl)
	namespace := "test-namespace"
	entry := &dataKeyCacheEntry{
		id:      "test-id",
		label:   "test-label",
		dataKey: []byte("test-key"),
		active:  true,
	}

	cache.addById(namespace, entry)
	retrievedEntry, exists := cache.getById(namespace, "test-id")

	assert.True(t, exists)
	assert.Equal(t, entry, retrievedEntry)
}

func TestAddAndGetByLabel(t *testing.T) {
	ttl := 5 * time.Minute
	cache := newMTDataKeyCache(ttl)
	namespace := "test-namespace"
	entry := &dataKeyCacheEntry{
		id:      "test-id",
		label:   "test-label",
		dataKey: []byte("test-key"),
		active:  true,
	}

	cache.addByLabel(namespace, entry)
	retrievedEntry, exists := cache.getByLabel(namespace, "test-label")

	assert.True(t, exists)
	assert.Equal(t, entry, retrievedEntry)
}

func TestExpiredEntry(t *testing.T) {
	ttl := 1 * time.Second
	cache := newMTDataKeyCache(ttl)
	namespace := "test-namespace"
	entry := &dataKeyCacheEntry{
		id:      "test-id",
		label:   "test-label",
		dataKey: []byte("test-key"),
		active:  true,
	}

	cache.addById(namespace, entry)
	time.Sleep(2 * time.Second)
	retrievedEntry, exists := cache.getById(namespace, "test-id")

	assert.False(t, exists)
	assert.Nil(t, retrievedEntry)
}

func TestRemoveExpired(t *testing.T) {
	ttl := 1 * time.Second
	cache := newMTDataKeyCache(ttl)
	namespace := "test-namespace"
	entry := &dataKeyCacheEntry{
		id:      "test-id",
		label:   "test-label",
		dataKey: []byte("test-key"),
		active:  true,
	}

	cache.addById(namespace, entry)
	time.Sleep(2 * time.Second)
	cache.removeExpired()
	retrievedEntry, exists := cache.getById(namespace, "test-id")

	assert.False(t, exists)
	assert.Nil(t, retrievedEntry)
}

func TestFlush(t *testing.T) {
	ttl := 5 * time.Minute
	cache := newMTDataKeyCache(ttl)
	namespace := "test-namespace"
	entry := &dataKeyCacheEntry{
		id:      "test-id",
		label:   "test-label",
		dataKey: []byte("test-key"),
		active:  true,
	}

	cache.addById(namespace, entry)
	cache.flush(namespace)
	retrievedEntry, exists := cache.getById(namespace, "test-id")

	assert.False(t, exists)
	assert.Nil(t, retrievedEntry)
}

package manager

import (
	"sync"
	"time"
)

var (
	now = time.Now
)

type dataKeyCacheEntry struct {
	dataKey    []byte
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

type dataKeyCache struct {
	sync.RWMutex
	entries  map[string]dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		entries:  make(map[string]dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

func (c *dataKeyCache) get(id string) ([]byte, bool) {
	c.RLock()
	defer c.RUnlock()

	entry, exists := c.entries[id]
	if !exists || entry.expired() {
		return nil, false
	}

	return entry.dataKey, true
}

func (c *dataKeyCache) add(id string, dataKey []byte) {
	c.Lock()
	defer c.Unlock()

	c.entries[id] = dataKeyCacheEntry{
		dataKey:    dataKey,
		expiration: now().Add(c.cacheTTL),
	}
}

func (c *dataKeyCache) removeExpired() {
	c.Lock()
	defer c.Unlock()

	for id, entry := range c.entries {
		if entry.expired() {
			delete(c.entries, id)
		}
	}
}

func (c *dataKeyCache) flush() {
	c.Lock()
	c.entries = make(map[string]dataKeyCacheEntry)
	c.Unlock()
}

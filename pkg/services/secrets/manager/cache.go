package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
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
	mtx      sync.RWMutex
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
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.entries[id]

	cacheReadsCounter.With(prometheus.Labels{
		"hit": strconv.FormatBool(exists),
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry.dataKey, true
}

func (c *dataKeyCache) add(id string, dataKey []byte) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	c.entries[id] = dataKeyCacheEntry{
		dataKey:    dataKey,
		expiration: now().Add(c.cacheTTL),
	}
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for id, entry := range c.entries {
		if entry.expired() {
			delete(c.entries, id)
		}
	}
}

func (c *dataKeyCache) flush() {
	c.mtx.Lock()
	c.entries = make(map[string]dataKeyCacheEntry)
	c.mtx.Unlock()
}

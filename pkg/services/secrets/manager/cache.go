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
	name       string
	dataKey    []byte
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

type dataKeyCache struct {
	mtx      sync.RWMutex
	entries  map[string]*dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		entries:  make(map[string]*dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

func (c *dataKeyCache) get(name string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.entries[name]

	cacheReadsCounter.With(prometheus.Labels{
		"hit": strconv.FormatBool(exists),
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) add(entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)
	c.entries[entry.name] = entry
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
	c.entries = make(map[string]*dataKeyCacheEntry)
	c.mtx.Unlock()
}

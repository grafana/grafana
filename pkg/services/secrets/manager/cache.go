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
	prefix     string
	name       string
	dataKey    []byte
	active     bool
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

type dataKeyCache struct {
	mtx      sync.RWMutex
	byPrefix map[string]*dataKeyCacheEntry
	byName   map[string]*dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		byPrefix: make(map[string]*dataKeyCacheEntry),
		byName:   make(map[string]*dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

func (c *dataKeyCache) getByPrefix(prefix string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byPrefix[prefix]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byPrefix",
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) getByName(name string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byName[name]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byName",
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

	c.byPrefix[entry.prefix] = entry
	c.byName[entry.name] = entry
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for id, entry := range c.byPrefix {
		if entry.expired() {
			delete(c.byPrefix, id)
		}
	}

	for name, entry := range c.byName {
		if entry.expired() {
			delete(c.byName, name)
		}
	}
}

func (c *dataKeyCache) flush() {
	c.mtx.Lock()
	c.byPrefix = make(map[string]*dataKeyCacheEntry)
	c.byName = make(map[string]*dataKeyCacheEntry)
	c.mtx.Unlock()
}

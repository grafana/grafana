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
	id         string
	name       string
	dataKey    []byte
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

type dataKeyCache struct {
	mtx      sync.RWMutex
	byId     map[string]*dataKeyCacheEntry
	byName   map[string]*dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		byId:     make(map[string]*dataKeyCacheEntry),
		byName:   make(map[string]*dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

func (c *dataKeyCache) getById(id string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byId[id]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byId",
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

	c.byId[entry.id] = entry
	c.byName[entry.name] = entry
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for id, entry := range c.byId {
		if entry.expired() {
			delete(c.byId, id)
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
	c.byId = make(map[string]*dataKeyCacheEntry)
	c.byName = make(map[string]*dataKeyCacheEntry)
	c.mtx.Unlock()
}

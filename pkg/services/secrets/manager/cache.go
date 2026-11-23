package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type dataKeyCacheEntry struct {
	tenant     string
	id         string
	label      string
	dataKey    []byte
	active     bool
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

// dataKeyCacheKey scopes a cached data key to the tenant whose store it was read from. Tenants'
// data keys can share a label, and a tenant must only ever use the data keys its own store holds.
type dataKeyCacheKey struct {
	tenant string
	value  string // the data key's id or label
}

type dataKeyCache struct {
	mtx      sync.RWMutex
	byId     map[dataKeyCacheKey]*dataKeyCacheEntry
	byLabel  map[dataKeyCacheKey]*dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		byId:     make(map[dataKeyCacheKey]*dataKeyCacheEntry),
		byLabel:  make(map[dataKeyCacheKey]*dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

func (c *dataKeyCache) getById(tenant string, id string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byId[dataKeyCacheKey{tenant: tenant, value: id}]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byId",
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) getByLabel(tenant string, label string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byLabel[dataKeyCacheKey{tenant: tenant, value: label}]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byLabel",
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) addById(entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	c.byId[dataKeyCacheKey{tenant: entry.tenant, value: entry.id}] = entry
}

func (c *dataKeyCache) addByLabel(entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	c.byLabel[dataKeyCacheKey{tenant: entry.tenant, value: entry.label}] = entry
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for key, entry := range c.byId {
		if entry.expired() {
			delete(c.byId, key)
		}
	}

	for key, entry := range c.byLabel {
		if entry.expired() {
			delete(c.byLabel, key)
		}
	}
}

func (c *dataKeyCache) flush() {
	c.mtx.Lock()
	c.byId = make(map[dataKeyCacheKey]*dataKeyCacheEntry)
	c.byLabel = make(map[dataKeyCacheKey]*dataKeyCacheEntry)
	c.mtx.Unlock()
}

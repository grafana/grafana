package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type dataKeyCacheEntry struct {
	namespace  string
	id         string
	label      string
	dataKey    []byte
	active     bool
	expiration time.Time
}

func (e dataKeyCacheEntry) expired() bool {
	return e.expiration.Before(now())
}

type dataKeyCache struct {
	mtx      sync.RWMutex
	byId     map[string]*dataKeyCacheEntry
	byLabel  map[string]*dataKeyCacheEntry
	cacheTTL time.Duration
}

func newDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		byId:     make(map[string]*dataKeyCacheEntry),
		byLabel:  make(map[string]*dataKeyCacheEntry),
		cacheTTL: ttl,
	}
}

// Cache keys are scoped by the tenant namespace because the store can resolve each tenant
// to its own data keys table, where neither ids nor labels are unique across tenants.
func cacheKey(namespace, key string) string {
	return namespace + "/" + key
}

func (c *dataKeyCache) getById(namespace, id string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byId[cacheKey(namespace, id)]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byId",
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) getByLabel(namespace, label string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byLabel[cacheKey(namespace, label)]

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

	c.byId[cacheKey(entry.namespace, entry.id)] = entry
}

func (c *dataKeyCache) addByLabel(entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	c.byLabel[cacheKey(entry.namespace, entry.label)] = entry
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for id, entry := range c.byId {
		if entry.expired() {
			delete(c.byId, id)
		}
	}

	for label, entry := range c.byLabel {
		if entry.expired() {
			delete(c.byLabel, label)
		}
	}
}

func (c *dataKeyCache) flush() {
	c.mtx.Lock()
	c.byId = make(map[string]*dataKeyCacheEntry)
	c.byLabel = make(map[string]*dataKeyCacheEntry)
	c.mtx.Unlock()
}

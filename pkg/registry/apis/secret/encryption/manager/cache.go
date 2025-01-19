package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type dataKeyCacheEntry struct {
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
	mtx sync.RWMutex

	namespacedCaches map[string]namespacedCache
	cacheTTL         time.Duration
}

type namespacedCache struct {
	byId    map[string]*dataKeyCacheEntry
	byLabel map[string]*dataKeyCacheEntry
}

func newMTDataKeyCache(ttl time.Duration) *dataKeyCache {
	return &dataKeyCache{
		namespacedCaches: map[string]namespacedCache{},
		cacheTTL:         ttl,
	}
}

func (c *dataKeyCache) getById(namespace, id string) (*dataKeyCacheEntry, bool) {
	var (
		exists bool
		entry  *dataKeyCacheEntry
	)

	c.mtx.RLock()
	defer c.mtx.RUnlock()

	cache, ok := c.namespacedCaches[namespace]
	if ok {
		entry, exists = cache.byId[id]
	}

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
	var (
		exists bool
		entry  *dataKeyCacheEntry
	)

	c.mtx.RLock()
	defer c.mtx.RUnlock()

	cache, ok := c.namespacedCaches[namespace]
	if ok {
		entry, exists = cache.byLabel[label]
	}

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byLabel",
	}).Inc()

	if !exists || entry.expired() {
		return nil, false
	}

	return entry, true
}

func (c *dataKeyCache) addById(namespace string, entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	cache, ok := c.namespacedCaches[namespace]
	if ok {
		cache.byId[entry.id] = entry
	} else {
		c.namespacedCaches[namespace] = namespacedCache{
			byId: map[string]*dataKeyCacheEntry{
				entry.id: entry,
			},
			byLabel: make(map[string]*dataKeyCacheEntry),
		}
	}
}

func (c *dataKeyCache) addByLabel(namespace string, entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	cache, ok := c.namespacedCaches[namespace]
	if ok {
		cache.byLabel[entry.label] = entry
	} else {
		c.namespacedCaches[namespace] = namespacedCache{
			byId: make(map[string]*dataKeyCacheEntry),
			byLabel: map[string]*dataKeyCacheEntry{
				entry.label: entry,
			},
		}
	}
}

func (c *dataKeyCache) removeExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for _, cache := range c.namespacedCaches {
		for id, entry := range cache.byId {
			if entry.expired() {
				delete(cache.byId, id)
			}
		}

		for label, entry := range cache.byLabel {
			if entry.expired() {
				delete(cache.byLabel, label)
			}
		}
	}
}

func (c *dataKeyCache) flush(namespace string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	cache, ok := c.namespacedCaches[namespace]
	if !ok {
		return
	}
	cache.byId = make(map[string]*dataKeyCacheEntry)
	cache.byLabel = make(map[string]*dataKeyCacheEntry)
	c.namespacedCaches[namespace] = cache
}

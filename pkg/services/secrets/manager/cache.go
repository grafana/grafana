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

func (c *dataKeyCache) getByLabel(label string) (*dataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byLabel[label]

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

	c.byId[entry.id] = entry
}

func (c *dataKeyCache) addByLabel(entry *dataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.expiration = now().Add(c.cacheTTL)

	c.byLabel[entry.label] = entry
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

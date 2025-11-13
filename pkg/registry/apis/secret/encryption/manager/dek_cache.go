package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type ossDataKeyCache struct {
	mtx      sync.RWMutex
	byId     map[string]*encryption.DataKeyCacheEntry
	byLabel  map[string]*encryption.DataKeyCacheEntry
	cacheTTL time.Duration
}

func ProvideOSSDataKeyCache(cfg *setting.Cfg) encryption.DataKeyCache {
	return &ossDataKeyCache{
		byId:     make(map[string]*encryption.DataKeyCacheEntry),
		byLabel:  make(map[string]*encryption.DataKeyCacheEntry),
		cacheTTL: cfg.SecretsManagement.DataKeysCacheTTL,
	}
}

func (c *ossDataKeyCache) GetById(id string) (*encryption.DataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byId[id]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byId",
	}).Inc()

	if !exists || entry.IsExpired() {
		return nil, false
	}

	return entry, true
}

func (c *ossDataKeyCache) GetByLabel(label string) (*encryption.DataKeyCacheEntry, bool) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists := c.byLabel[label]

	cacheReadsCounter.With(prometheus.Labels{
		"hit":    strconv.FormatBool(exists),
		"method": "byLabel",
	}).Inc()

	if !exists || entry.IsExpired() {
		return nil, false
	}

	return entry, true
}

func (c *ossDataKeyCache) AddById(entry *encryption.DataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.Expiration = time.Now().Add(c.cacheTTL)

	c.byId[entry.Id] = entry
}

func (c *ossDataKeyCache) AddByLabel(entry *encryption.DataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.Expiration = time.Now().Add(c.cacheTTL)

	c.byLabel[entry.Label] = entry
}

func (c *ossDataKeyCache) RemoveExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for id, entry := range c.byId {
		if entry.IsExpired() {
			delete(c.byId, id)
		}
	}

	for label, entry := range c.byLabel {
		if entry.IsExpired() {
			delete(c.byLabel, label)
		}
	}
}

func (c *ossDataKeyCache) Flush() {
	c.mtx.Lock()
	c.byId = make(map[string]*encryption.DataKeyCacheEntry)
	c.byLabel = make(map[string]*encryption.DataKeyCacheEntry)
	c.mtx.Unlock()
}

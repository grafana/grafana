package manager

import (
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type namespacedKey struct {
	namespace string
	value     string
}

type ossDataKeyCache struct {
	mtx      sync.RWMutex
	byId     map[namespacedKey]encryption.DataKeyCacheEntry
	byLabel  map[namespacedKey]encryption.DataKeyCacheEntry
	cacheTTL time.Duration

	log log.Logger
}

func ProvideOSSDataKeyCache(cfg *setting.Cfg) encryption.DataKeyCache {
	return &ossDataKeyCache{
		byId:     make(map[namespacedKey]encryption.DataKeyCacheEntry),
		byLabel:  make(map[namespacedKey]encryption.DataKeyCacheEntry),
		cacheTTL: cfg.SecretsManagement.DataKeysCacheTTL,
		log:      log.New("oss_dek_cache"),
	}
}

func (c *ossDataKeyCache) GetById(namespace, id string) (_ encryption.DataKeyCacheEntry, exists bool) {
	defer func() {
		cacheReadsCounter.With(prometheus.Labels{
			"hit":    strconv.FormatBool(exists),
			"method": "byId",
		}).Inc()
	}()

	var entry encryption.DataKeyCacheEntry

	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists = c.byId[namespacedKey{namespace, id}]
	if !exists {
		return entry, false
	}
	if entry.Namespace != namespace {
		c.log.Error("Broken invariant!!! Expected %s but got %s. ID: %s", namespace, entry.Namespace, id)
		return encryption.DataKeyCacheEntry{}, false
	}
	if entry.IsExpired() {
		return entry, false
	}

	return entry, true
}

func (c *ossDataKeyCache) GetByLabel(namespace, label string) (_ encryption.DataKeyCacheEntry, exists bool) {
	defer func() {
		cacheReadsCounter.With(prometheus.Labels{
			"hit":    strconv.FormatBool(exists),
			"method": "byLabel",
		}).Inc()
	}()

	var entry encryption.DataKeyCacheEntry

	c.mtx.RLock()
	defer c.mtx.RUnlock()

	entry, exists = c.byLabel[namespacedKey{namespace, label}]
	if !exists {
		return entry, false
	}
	if entry.Namespace != namespace {
		c.log.Error("Broken invariant!!! Expected %s but got %s. Label: %s", namespace, entry.Namespace, label)
		return encryption.DataKeyCacheEntry{}, false
	}
	if entry.IsExpired() {
		return entry, false
	}
	return entry, true
}

func (c *ossDataKeyCache) Set(namespace string, entry encryption.DataKeyCacheEntry) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.Expiration = time.Now().Add(c.cacheTTL)
	entry.Namespace = namespace

	if _, exists := c.byId[namespacedKey{namespace, entry.Id}]; !exists {
		c.byId[namespacedKey{namespace, entry.Id}] = entry
	}
	if _, exists := c.byLabel[namespacedKey{namespace, entry.Label}]; !exists {
		c.byLabel[namespacedKey{namespace, entry.Label}] = entry
	}
}

func (c *ossDataKeyCache) RemoveExpired() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for key, entry := range c.byId {
		if entry.IsExpired() {
			delete(c.byId, key)
		}
	}

	for key, entry := range c.byLabel {
		if entry.IsExpired() {
			delete(c.byLabel, key)
		}
	}
}

func (c *ossDataKeyCache) Flush(namespace string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for key := range c.byId {
		if key.namespace == namespace {
			delete(c.byId, key)
		}
	}

	for key := range c.byLabel {
		if key.namespace == namespace {
			delete(c.byLabel, key)
		}
	}
}

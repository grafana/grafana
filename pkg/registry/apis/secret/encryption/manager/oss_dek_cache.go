package manager

import (
	"context"
	"strconv"
	"sync"
	"time"

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
}

func ProvideOSSDataKeyCache(cfg *setting.Cfg) encryption.DataKeyCache {
	return &ossDataKeyCache{
		byId:     make(map[namespacedKey]encryption.DataKeyCacheEntry),
		byLabel:  make(map[namespacedKey]encryption.DataKeyCacheEntry),
		cacheTTL: cfg.SecretsManagement.DataKeysCacheTTL,
	}
}

func (c *ossDataKeyCache) GetById(_ context.Context, namespace, id string) (_ encryption.DataKeyCacheEntry, exists bool, err error) {
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
		return entry, false, nil
	}
	if validateErr := encryption.ValidateDataKeyCacheEntryNamespace(namespace, entry); validateErr != nil {
		return encryption.DataKeyCacheEntry{}, false, validateErr
	}
	if entry.IsExpired() {
		return entry, false, nil
	}

	return entry, true, nil
}

func (c *ossDataKeyCache) GetByLabel(_ context.Context, namespace, label string) (_ encryption.DataKeyCacheEntry, exists bool, err error) {
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
		return entry, false, nil
	}
	if validateErr := encryption.ValidateDataKeyCacheEntryNamespace(namespace, entry); validateErr != nil {
		return encryption.DataKeyCacheEntry{}, false, validateErr
	}
	if entry.IsExpired() {
		return entry, false, nil
	}
	return entry, true, nil
}

func (c *ossDataKeyCache) Set(_ context.Context, namespace string, entry encryption.DataKeyCacheEntry) error {
	if err := encryption.ValidateDataKeyCacheEntryNamespace(namespace, entry); err != nil {
		return err
	}

	c.mtx.Lock()
	defer c.mtx.Unlock()

	entry.Expiration = time.Now().Add(c.cacheTTL)

	c.byId[namespacedKey{namespace, entry.Id}] = entry
	c.byLabel[namespacedKey{namespace, entry.Label}] = entry
	return nil
}

func (c *ossDataKeyCache) RemoveExpired(_ context.Context) {
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

func (c *ossDataKeyCache) Flush(_ context.Context, namespace string) {
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

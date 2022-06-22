package kvstore

import (
	"fmt"
	"sync"
	"time"
)

type decryptionCache struct {
	decryptionCache map[string]*cachedDecrypted
	sync.Mutex
}

type cachedDecrypted struct {
	lastAccess time.Time
	updated    time.Time
	value      string
}

const (
	recentTimeout = time.Second * 5
)

func newDecryptionCache() decryptionCache {
	return decryptionCache{
		decryptionCache: make(map[string]*cachedDecrypted),
	}
}

func (c *decryptionCache) key(orgId int64, namespace string, typ string) string {
	return fmt.Sprintf("%d:%s:%s", orgId, namespace, typ)
}

func (c *decryptionCache) get(orgId int64, namespace string, typ string) *cachedDecrypted {
	if cache, ok := c.decryptionCache[c.key(orgId, namespace, typ)]; ok {
		cache.lastAccess = time.Now()
		return cache
	}
	return nil
}

func (c *decryptionCache) set(orgId int64, namespace string, typ string, value string, updated time.Time) {
	c.decryptionCache[c.key(orgId, namespace, typ)] = &cachedDecrypted{
		value:      value,
		updated:    updated,
		lastAccess: time.Now(),
	}
}

func (c *decryptionCache) delete(orgId int64, namespace string, typ string) {
	delete(c.decryptionCache, c.key(orgId, namespace, typ))
}

func (c *decryptionCache) rename(orgId int64, namespace string, typ string, newNamespace string, updated time.Time) {
	if cache, ok := c.decryptionCache[c.key(orgId, namespace, typ)]; ok {
		c.set(orgId, newNamespace, typ, cache.value, updated)
		c.delete(orgId, namespace, typ)
	}
}

func (c *decryptionCache) recent(orgId int64, namespace string, typ string) *cachedDecrypted {
	if cache, ok := c.decryptionCache[c.key(orgId, namespace, typ)]; ok {
		if time.Since(cache.lastAccess) < recentTimeout {
			cache.lastAccess = time.Now()
			return cache
		}
	}
	return nil
}

package push

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type keyCheckFunc func(key string) (*models.ApiKey, bool, error)

type keyInfo struct {
	ExpiresAt int64
}

// Cache API keys to avoid pretty expensive (10ms at the moment of writing)
// token check on every incoming request. apiKeyCache periodically validates
// saved keys and removes them from internal map. Since validation happens in
// separate goroutine we can keep HTTP handler latency low. Requires more than
// one CPU core to work as intended.
type apiKeyCache struct {
	mu            sync.RWMutex
	checkInterval time.Duration
	keyCheckFunc  keyCheckFunc
	cache         map[string]keyInfo
}

func newAPIKeyCache(keyCheck keyCheckFunc, checkInterval time.Duration) *apiKeyCache {
	return &apiKeyCache{
		checkInterval: checkInterval,
		keyCheckFunc:  keyCheck,
		cache:         map[string]keyInfo{},
	}
}

func (c *apiKeyCache) invalidateKeys() {
	c.mu.RLock()
	// Get a snapshot of current keys to avoid locking for a long time.
	keys := make(map[string]keyInfo, len(c.cache))
	for key, info := range c.cache {
		keys[key] = info
	}
	c.mu.RUnlock()

	// Now iterate over a snapshot - check key expiration time and the
	// fact that key has not been revoked.
	for key, info := range keys {
		if info.ExpiresAt > 0 && time.Now().Unix() > info.ExpiresAt {
			c.mu.Lock()
			delete(c.cache, key)
			c.mu.Unlock()
			continue
		}
		_, ok, err := c.keyCheckFunc(key)
		if err != nil {
			// Let's bet on next tick, maybe better to skip checking all other keys for this tick?
			logger.Error("Error checking API key", "error", err)
			continue
		}
		if ok {
			// Key is still valid.
			continue
		}
		c.mu.Lock()
		delete(c.cache, key)
		c.mu.Unlock()
	}
}

func (c *apiKeyCache) Run(ctx context.Context) error {
	tm := time.NewTimer(c.checkInterval)
	defer tm.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-tm.C:
			c.invalidateKeys()
			tm.Reset(c.checkInterval)
		}
	}
}

func (c *apiKeyCache) Get(key string) (keyInfo, bool) {
	c.mu.RLock()
	existingKey, ok := c.cache[key]
	c.mu.RUnlock()
	if existingKey.ExpiresAt > 0 && existingKey.ExpiresAt < time.Now().Unix() {
		c.mu.Lock()
		delete(c.cache, key)
		c.mu.Unlock()
		return keyInfo{}, false
	}
	return existingKey, ok
}

func (c *apiKeyCache) Set(key string, keyExpiresAt *int64) {
	var expiresAt int64
	if keyExpiresAt != nil {
		expiresAt = *keyExpiresAt
	}
	c.mu.Lock()
	c.cache[key] = keyInfo{ExpiresAt: expiresAt}
	c.mu.Unlock()
}

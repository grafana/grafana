package webhooks

import (
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
)

// defaultReplayCacheTTL is the lifetime of a recorded webhook replay key. It
// must comfortably exceed a provider's webhook retry window so that a replayed
// request is still considered a duplicate.
const defaultReplayCacheTTL = time.Hour

// maxReplayCacheEntries bounds the cache memory footprint. Provisioning webhook
// volume per instance is low, so an attacker would need an implausible burst to
// evict a still-live entry within the TTL — and the worst case of an
// evicted-then-replayed delivery is a single idempotent sync job.
const maxReplayCacheEntries = 10000

// replayCache tracks recently-seen webhook replay keys so the dispatcher can
// reject replayed requests. The key is the provider's validated request
// signature, which binds the entry to the signed request body and the
// repository's unique secret, so it cannot be forged or collided across
// repositories.
type replayCache struct {
	// expirable.LRU is internally locked, but seenOrAdd's Get-then-Add is two
	// calls; this mutex makes the check-and-set atomic so concurrent identical
	// requests register exactly one as new.
	mu  sync.Mutex
	lru *expirable.LRU[string, struct{}]
}

func newReplayCache(ttl time.Duration) *replayCache {
	return &replayCache{
		lru: expirable.NewLRU[string, struct{}](maxReplayCacheEntries, nil, ttl),
	}
}

// seenOrAdd returns true if key has been recorded within the TTL window.
// Otherwise it records key and returns false. An empty key is never considered
// a duplicate so callers can decide how to handle missing values.
func (c *replayCache) seenOrAdd(key string) bool {
	if key == "" {
		return false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Get honors per-entry expiry on read; Contains only checks map membership
	// and would report an expired-but-unswept entry as still present.
	if _, ok := c.lru.Get(key); ok {
		return true
	}
	c.lru.Add(key, struct{}{})
	return false
}

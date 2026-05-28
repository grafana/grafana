package github

import (
	"sync"
	"time"
)

// defaultDeliveryIDCacheTTL is the lifetime of a recorded GitHub webhook
// delivery ID. It must comfortably exceed GitHub's webhook retry window so
// that a replayed request is still considered a duplicate.
const defaultDeliveryIDCacheTTL = time.Hour

// sharedDeliveryCache is the process-wide replay cache. The webhook handler
// is invoked on a freshly-built repository per request, so the cache cannot
// live on the repository instance and still detect replays across requests.
var sharedDeliveryCache = newDeliveryIDCache(defaultDeliveryIDCacheTTL)

// deliveryIDCache tracks recently-seen GitHub webhook delivery IDs so the
// webhook handler can reject replayed requests. GitHub sets a unique UUID in
// the X-GitHub-Delivery header for every delivery attempt of an event.
type deliveryIDCache struct {
	ttl time.Duration
	now func() time.Time

	mu  sync.Mutex
	ids map[string]time.Time
}

func newDeliveryIDCache(ttl time.Duration) *deliveryIDCache {
	return &deliveryIDCache{
		ttl: ttl,
		now: time.Now,
		ids: make(map[string]time.Time),
	}
}

// seenOrAdd returns true if id has been recorded within the TTL window.
// Otherwise it records id and returns false. An empty id is never considered
// a duplicate so callers can decide how to handle missing headers.
func (c *deliveryIDCache) seenOrAdd(id string) bool {
	if id == "" {
		return false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	for k, expiry := range c.ids {
		if !now.Before(expiry) {
			delete(c.ids, k)
		}
	}

	if _, ok := c.ids[id]; ok {
		return true
	}
	c.ids[id] = now.Add(c.ttl)
	return false
}

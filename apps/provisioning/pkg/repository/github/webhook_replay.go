package github

import (
	"container/list"
	"sync"
	"time"
)

// defaultDeliveryIDCacheTTL is the lifetime of a recorded GitHub webhook
// delivery ID. It must comfortably exceed GitHub's webhook retry window so
// that a replayed request is still considered a duplicate.
const defaultDeliveryIDCacheTTL = time.Hour

// deliveryIDCache tracks recently-seen GitHub webhook delivery IDs so the
// webhook handler can reject replayed requests. GitHub sets a unique UUID in
// the X-GitHub-Delivery header for every delivery attempt of an event.
//
// Eviction is amortized O(1): every entry shares the same TTL, so insertion
// order equals expiration order. We walk a FIFO from the front and stop at
// the first live entry — work is proportional to the number of newly-expired
// entries, not to the cache size.
type deliveryIDCache struct {
	ttl time.Duration
	now func() time.Time

	mu    sync.Mutex
	ids   map[string]*list.Element // id → element in order
	order *list.List               // FIFO of *cacheEntry, oldest at front
}

type cacheEntry struct {
	id     string
	expiry time.Time
}

func newDeliveryIDCache(ttl time.Duration) *deliveryIDCache {
	return &deliveryIDCache{
		ttl:   ttl,
		now:   time.Now,
		ids:   make(map[string]*list.Element),
		order: list.New(),
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
	for e := c.order.Front(); e != nil; e = c.order.Front() {
		entry := e.Value.(*cacheEntry)
		if entry.expiry.After(now) {
			break
		}
		c.order.Remove(e)
		delete(c.ids, entry.id)
	}

	if _, ok := c.ids[id]; ok {
		return true
	}
	el := c.order.PushBack(&cacheEntry{id: id, expiry: now.Add(c.ttl)})
	c.ids[id] = el
	return false
}

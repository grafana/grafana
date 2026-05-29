package github

import (
	"container/list"
	"sync"
	"time"
)

// defaultReplayCacheTTL is the lifetime of a recorded webhook replay key. It
// must comfortably exceed GitHub's webhook retry window so that a replayed
// request is still considered a duplicate.
const defaultReplayCacheTTL = time.Hour

// replayCache tracks recently-seen webhook replay keys so the webhook handler
// can reject replayed requests. The key is the validated HMAC signature
// (X-Hub-Signature-256), which binds the entry to the signed request body and
// the repository's unique secret — see Webhook for why the unauthenticated
// X-GitHub-Delivery header is not used as the key.
//
// Eviction is amortized O(1): every entry shares the same TTL, so insertion
// order equals expiration order. We walk a FIFO from the front and stop at
// the first live entry — work is proportional to the number of newly-expired
// entries, not to the cache size.
type replayCache struct {
	ttl time.Duration
	now func() time.Time

	mu    sync.Mutex
	keys  map[string]*list.Element // key → element in order
	order *list.List               // FIFO of *cacheEntry, oldest at front
}

type cacheEntry struct {
	key    string
	expiry time.Time
}

func newReplayCache(ttl time.Duration) *replayCache {
	return &replayCache{
		ttl:   ttl,
		now:   time.Now,
		keys:  make(map[string]*list.Element),
		order: list.New(),
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

	now := c.now()
	for e := c.order.Front(); e != nil; e = c.order.Front() {
		entry := e.Value.(*cacheEntry)
		if entry.expiry.After(now) {
			break
		}
		c.order.Remove(e)
		delete(c.keys, entry.key)
	}

	if _, ok := c.keys[key]; ok {
		return true
	}
	el := c.order.PushBack(&cacheEntry{key: key, expiry: now.Add(c.ttl)})
	c.keys[key] = el
	return false
}

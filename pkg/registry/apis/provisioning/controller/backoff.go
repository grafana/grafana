package controller

import (
	"hash/fnv"
	"math"
	"strconv"
	"sync"
	"time"
)

const (
	// unhealthyBackoffCap bounds the delay between attempts for a repository that
	// keeps failing, before jitter is applied.
	unhealthyBackoffCap = 30 * time.Minute
	// syncJitterFraction spreads interval-driven work by up to +/- this fraction
	// so repositories that failed together do not retry together.
	syncJitterFraction = 0.2
)

// unhealthyBackoff tracks, per repository key, how many reconciles in a row
// failed to build the repository or found it unhealthy, and until when interval
// and health-check triggers should be suppressed. It lives in memory: a restart
// or a key moving to another replica starts from no backoff, which is safe.
// The zero value is ready to use.
type unhealthyBackoff struct {
	mu      sync.Mutex
	entries map[string]backoffEntry
}

type backoffEntry struct {
	failures int
	until    time.Time
}

// active reports whether key is still backing off at now.
func (b *unhealthyBackoff) active(key string, now time.Time) (time.Time, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	e, ok := b.entries[key]
	if !ok || !now.Before(e.until) {
		return time.Time{}, false
	}
	return e.until, true
}

// recordFailure counts another consecutive failure for key and returns the
// jittered delay before interval or health-check triggers may run again.
func (b *unhealthyBackoff) recordFailure(key string, base time.Duration, now time.Time) time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.entries == nil {
		b.entries = make(map[string]backoffEntry)
	}
	e := b.entries[key]
	e.failures++
	delay := jitterDuration(backoffDelay(e.failures, base), key+"/"+strconv.Itoa(e.failures))
	e.until = now.Add(delay)
	b.entries[key] = e
	return delay
}

// reset clears the backoff for key after a healthy reconcile.
func (b *unhealthyBackoff) reset(key string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.entries, key)
}

// backoffDelay returns base doubled for every consecutive failure after the
// first, capped at unhealthyBackoffCap.
func backoffDelay(failures int, base time.Duration) time.Duration {
	if base <= 0 {
		base = unhealthyBackoffCap
	}
	delay := base
	for i := 1; i < failures && delay < unhealthyBackoffCap; i++ {
		delay *= 2
	}
	return min(delay, unhealthyBackoffCap)
}

// jitterDuration shifts d by up to +/- syncJitterFraction. The offset is derived
// from seed rather than drawn at random so the same repository and cycle get the
// same threshold on every informer redelivery and on every replica, while
// different repositories spread out.
func jitterDuration(d time.Duration, seed string) time.Duration {
	h := fnv.New64a()
	_, _ = h.Write([]byte(seed))
	factor := float64(h.Sum64())/float64(math.MaxUint64)*2 - 1
	return d + time.Duration(factor*syncJitterFraction*float64(d))
}

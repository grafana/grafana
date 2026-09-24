package controller

import (
	"sync"
	"time"
)

// queueLagTracker tracks each key's first-enqueue time through two maps —
// waiting (enqueued, not yet picked up) and inflight (being processed) — so the
// controller can report queue lag: how long the oldest unfinished key has been
// queued. Enqueue is first-wins; the zero value is ready to use.
type queueLagTracker struct {
	mu       sync.Mutex
	waiting  map[string]time.Time
	inflight map[string]time.Time
}

// add stamps key's enqueue time, first-wins: a coalesced re-add keeps the
// earliest timestamp, and a re-add of a key still in flight (informer update,
// AddAfter, or a retry) inherits its original enqueue time so lag keeps
// measuring from the first enqueue rather than resetting.
func (q *queueLagTracker) add(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.waiting == nil {
		q.waiting = make(map[string]time.Time)
	}
	if _, ok := q.waiting[key]; ok {
		return
	}
	if t, ok := q.inflight[key]; ok {
		q.waiting[key] = t
		return
	}
	q.waiting[key] = time.Now()
}

// get moves key from waiting to inflight, returning its enqueue
// time; false if it was untracked (e.g. a struct-literal test).
func (q *queueLagTracker) get(key string) (time.Time, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	t, ok := q.waiting[key]
	if !ok {
		return time.Time{}, false
	}
	delete(q.waiting, key)
	if q.inflight == nil {
		q.inflight = make(map[string]time.Time)
	}
	q.inflight[key] = t
	return t, true
}

// done drops key from inflight. Idempotent, so it is safe to call
// eagerly and from a deferred safety net.
func (q *queueLagTracker) done(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	delete(q.inflight, key)
}

// lag returns how long the oldest unfinished key (waiting or inflight) has been
// queued, from first enqueue; 0 when idle.
func (q *queueLagTracker) lag() time.Duration {
	q.mu.Lock()
	defer q.mu.Unlock()
	var oldest time.Time
	for _, t := range q.waiting {
		if oldest.IsZero() || t.Before(oldest) {
			oldest = t
		}
	}
	for _, t := range q.inflight {
		if oldest.IsZero() || t.Before(oldest) {
			oldest = t
		}
	}
	if oldest.IsZero() {
		return 0
	}
	return time.Since(oldest)
}

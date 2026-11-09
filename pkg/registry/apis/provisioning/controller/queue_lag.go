package controller

import (
	"container/list"
	"sync"
	"time"
)

// queueLagTracker tracks each key's first-enqueue time through two sets —
// waiting (enqueued, not yet picked up) and inflight (being processed) — so the
// controller can report queue lag: how long the oldest unfinished key has been
// queued. Enqueue is first-wins.
//
// The active keys are also chained in first-enqueue order (oldest at the front)
// so lag is an O(1) front read rather than a scan. This matters because lag is
// read on every enqueue and completion: a resync that enqueues N keys would
// otherwise cost O(N^2). Enqueue timestamps are monotonic, so insertion order is
// age order and the front is always the oldest. The zero value is ready to use.
type queueLagTracker struct {
	mu       sync.Mutex
	waiting  map[string]time.Time
	inflight map[string]time.Time
	order    *list.List               // *lagEntry, oldest first-enqueue at the front
	elems    map[string]*list.Element // active key -> its element in order
}

// lagEntry is one active key and its first-enqueue time, held in the order list.
type lagEntry struct {
	key string
	at  time.Time
}

// track records key as active at time t, appending it to the order list unless
// it is already tracked (so a re-add keeps its original position and time).
func (q *queueLagTracker) track(key string, t time.Time) {
	if q.elems == nil {
		q.order = list.New()
		q.elems = make(map[string]*list.Element)
	}
	if _, ok := q.elems[key]; !ok {
		q.elems[key] = q.order.PushBack(&lagEntry{key: key, at: t})
	}
}

// untrack removes key from the order list once it is no longer waiting or in
// flight.
func (q *queueLagTracker) untrack(key string) {
	if e, ok := q.elems[key]; ok {
		q.order.Remove(e)
		delete(q.elems, key)
	}
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
	now := time.Now()
	q.waiting[key] = now
	q.track(key, now)
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

// done drops key from inflight. Idempotent, so it is safe to call eagerly and
// from a deferred safety net. The key leaves the order list only once it is
// neither in flight nor re-queued as waiting.
func (q *queueLagTracker) done(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	delete(q.inflight, key)
	if _, ok := q.waiting[key]; !ok {
		q.untrack(key)
	}
}

// lag returns how long the oldest unfinished key (waiting or inflight) has been
// queued, from first enqueue; 0 when idle.
func (q *queueLagTracker) lag() time.Duration {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.order == nil || q.order.Len() == 0 {
		return 0
	}
	oldest := q.order.Front().Value.(*lagEntry).at
	return time.Since(oldest)
}

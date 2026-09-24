package controller

import (
	"sync"
	"time"
)

// queueWaitTracker records when each key first entered a controller's work
// queue so a worker can log how long the key waited before it was picked up.
// It mirrors the first-wins semantics of the workqueue's own latency metric:
// a coalesced re-add of an already-queued key keeps the earliest timestamp,
// and the entry is cleared when the key is picked up. The zero value is ready
// to use, so a controller built as a struct literal in tests needs no setup.
type queueWaitTracker struct {
	mu sync.Mutex
	at map[string]time.Time
}

// mark stamps now as key's enqueue time unless one is already pending, so a
// re-add that coalesces onto a still-queued key does not reset the wait clock.
func (q *queueWaitTracker) mark(key string, now time.Time) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.at == nil {
		q.at = make(map[string]time.Time)
	}
	if _, ok := q.at[key]; !ok {
		q.at[key] = now
	}
}

// pop returns key's enqueue time and removes it, reporting whether one was set.
// A missing entry means the key reached the worker without a tracked enqueue
// (e.g. built as a struct literal in a test), so the caller simply omits the
// wait from its log line.
func (q *queueWaitTracker) pop(key string) (time.Time, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	t, ok := q.at[key]
	if ok {
		delete(q.at, key)
	}
	return t, ok
}

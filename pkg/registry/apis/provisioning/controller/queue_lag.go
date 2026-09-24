package controller

import (
	"sync"
	"time"
)

// queueLagTracker records when each key first entered a controller's work
// queue and follows it through processing, so a worker can log how long a key
// waited and the controller can report how far behind it is (queue lag).
//
// A key lives in one of two maps, both stamped with its first-enqueue time:
//   - waiting:  enqueued, not yet picked up by a worker.
//   - inflight: picked up and being processed, not yet finished.
//
// Enqueue is first-wins (a coalesced re-add of a still-waiting key keeps the
// earliest timestamp, mirroring the workqueue latency metric). At pickup the
// key moves waiting -> inflight, keeping its original enqueue time; at
// completion it is removed. Lag therefore spans both the queue wait and the
// in-progress work, so a saturated worker pool grinding on long reconciles
// still reports lag even when the queue has drained. The zero value is ready
// to use, so a controller built as a struct literal in tests needs no setup.
type queueLagTracker struct {
	mu       sync.Mutex
	waiting  map[string]time.Time
	inflight map[string]time.Time
}

// mark stamps now as key's enqueue time unless one is already waiting, so a
// re-add that coalesces onto a still-waiting key does not reset the wait clock.
func (q *queueLagTracker) mark(key string, now time.Time) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.waiting == nil {
		q.waiting = make(map[string]time.Time)
	}
	if _, ok := q.waiting[key]; !ok {
		q.waiting[key] = now
	}
}

// startProcessing moves key from waiting to inflight and returns its enqueue
// time, reporting whether one was set. A missing entry means the key reached
// the worker without a tracked enqueue (e.g. built as a struct literal in a
// test), so the caller simply omits the wait from its log line and the key is
// not tracked as inflight.
func (q *queueLagTracker) startProcessing(key string) (time.Time, bool) {
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

// finishProcessing removes key from the inflight set once its reconcile ends.
// It is idempotent, so it is safe to call both eagerly (to exclude the key from
// a completion-time lag reading) and from a deferred crash-safety net.
func (q *queueLagTracker) finishProcessing(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	delete(q.inflight, key)
}

// lag reports how long the oldest key that has not finished processing has been
// in the pipeline, measured from its first enqueue across both the waiting and
// inflight sets. It returns 0 when nothing is pending or in flight.
func (q *queueLagTracker) lag(now time.Time) time.Duration {
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
	return now.Sub(oldest)
}

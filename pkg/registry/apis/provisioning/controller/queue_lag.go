package controller

import (
	"container/list"
	"sync"
	"time"
)

// queueLagTracker tracks enqueue times for waiting and in-flight work. A key
// re-enqueued during processing has a separate waiting entry, so completing the
// current pass preserves the next pass's wait without carrying over the old age.
//
// The entries are also chained in enqueue order (oldest at the front)
// so lag is an O(1) front read rather than a scan. This matters because lag is
// read on every enqueue and completion: a resync that enqueues N keys would
// otherwise cost O(N^2). Enqueue timestamps are monotonic, so insertion order is
// age order and the front is always the oldest. The zero value is ready to use.
type queueLagTracker struct {
	mu       sync.Mutex
	waiting  map[string]*list.Element
	inflight map[string]*list.Element
	order    list.List // time.Time, oldest enqueue at the front
}

// add preserves the first waiting enqueue, independently of any in-flight pass.
func (q *queueLagTracker) add(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.waiting == nil {
		q.waiting = make(map[string]*list.Element)
	}
	if _, ok := q.waiting[key]; ok {
		return
	}
	q.waiting[key] = q.order.PushBack(time.Now())
}

// get moves key from waiting to inflight, returning its enqueue
// time; false if it was untracked (e.g. a struct-literal test).
func (q *queueLagTracker) get(key string) (time.Time, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	entry, ok := q.waiting[key]
	if !ok {
		return time.Time{}, false
	}
	delete(q.waiting, key)
	if q.inflight == nil {
		q.inflight = make(map[string]*list.Element)
	}
	q.inflight[key] = entry
	return entry.Value.(time.Time), true
}

// done removes only the completed pass. Idempotent, so eager and deferred cleanup
// leave a re-enqueued key's waiting entry and timestamp intact.
func (q *queueLagTracker) done(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	entry, ok := q.inflight[key]
	if !ok {
		return
	}
	delete(q.inflight, key)
	q.order.Remove(entry)
}

// lag includes processing time until completion, even when no keys are waiting.
func (q *queueLagTracker) lag() time.Duration {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.order.Len() == 0 {
		return 0
	}
	oldest := q.order.Front().Value.(time.Time)
	return time.Since(oldest)
}

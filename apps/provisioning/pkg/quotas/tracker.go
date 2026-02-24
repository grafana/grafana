package quotas

import "sync"

// QuotaTracker provides best-effort, in-memory quota enforcement.
type QuotaTracker struct {
	mu      sync.Mutex
	current int64
	limit   int64 // 0 means unlimited
}

// NewQuotaTracker creates a new QuotaTracker.
// currentUsage is the current usage of the quota.
// limit is the limit of the quota. 0 means unlimited. limit should be >= 0.
func NewQuotaTracker(currentUsage, limit int64) *QuotaTracker {
	return &QuotaTracker{
		current: currentUsage,
		limit:   limit,
	}
}

// TryAcquire checks if creating one more resource would stay within the quota.
func (q *QuotaTracker) TryAcquire() bool {
	if q.limit == 0 {
		return true
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.current >= q.limit {
		return false
	}
	q.current++
	return true
}

// Release decrements the resource counter, e.g. after a successful deletion.
func (q *QuotaTracker) Release() {
	if q.limit == 0 {
		return
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.current > 0 {
		q.current--
	}
}

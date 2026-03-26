package quotas

import "sync"

// QuotaTracker provides quota enforcement for resource creation and deletion.
//
//go:generate mockery --name QuotaTracker --structname MockQuotaTracker --inpackage --filename mock_quota_tracker.go --with-expecter
type QuotaTracker interface {
	// TryAcquire checks if creating one more resource would stay within the quota.
	TryAcquire() bool
	// Release decrements the resource counter, e.g. after a successful deletion.
	Release()
}

// inMemoryQuotaTracker provides best-effort, in-memory quota enforcement.
type inMemoryQuotaTracker struct {
	mu      sync.Mutex
	current int64
	limit   int64 // 0 means unlimited
}

// NewInMemoryQuotaTracker creates a new in-memory QuotaTracker.
// currentUsage is the current usage of the quota.
// limit is the limit of the quota. 0 means unlimited. limit should be >= 0.
func NewInMemoryQuotaTracker(currentUsage, limit int64) QuotaTracker {
	return &inMemoryQuotaTracker{
		current: currentUsage,
		limit:   limit,
	}
}

func (q *inMemoryQuotaTracker) TryAcquire() bool {
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

func (q *inMemoryQuotaTracker) Release() {
	if q.limit == 0 {
		return
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.current > 0 {
		q.current--
	}
}

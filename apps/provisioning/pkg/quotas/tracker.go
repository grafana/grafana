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
	// AllowOverLimit raises the quota limit by n for the remaining lifetime of
	// the tracker. This is useful for situations where counting may be inaccurate.
	AllowOverLimit(n int)
}

// inMemoryQuotaTracker provides best-effort, in-memory quota enforcement.
type inMemoryQuotaTracker struct {
	// limit is immutable after construction
	limit int64 // 0 means unlimited

	mu      sync.Mutex
	current int64
	extra   int64 // additional allowance on top of limit; guarded by mu
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
	if q.current >= q.limit+q.extra {
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

func (q *inMemoryQuotaTracker) AllowOverLimit(n int) {
	if q.limit == 0 || n <= 0 {
		return
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	q.extra += int64(n)
}

package rendering

import (
	"context"
	"sync"
)

type Tenant struct {
	Namespace string
	OrgID     int64
}

// ConcurrencyLimiter acquires a slot until the returned release function is called.
// Distributed implementations must acquire atomically and expire abandoned leases.
type ConcurrencyLimiter interface {
	Acquire(context.Context, Tenant, int) (release func(), err error)
}

// LocalConcurrencyLimiter enforces limits within one process.
type LocalConcurrencyLimiter struct {
	mu         sync.Mutex
	inProgress map[Tenant]int
}

func NewLocalConcurrencyLimiter() *LocalConcurrencyLimiter {
	return &LocalConcurrencyLimiter{inProgress: make(map[Tenant]int)}
}

func (l *LocalConcurrencyLimiter) Acquire(ctx context.Context, tenant Tenant, limit int) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if limit > 0 && l.inProgress[tenant] >= limit {
		return nil, ErrConcurrentLimitReached
	}

	l.inProgress[tenant]++

	return sync.OnceFunc(func() {
		l.mu.Lock()
		defer l.mu.Unlock()

		l.inProgress[tenant]--
		if l.inProgress[tenant] == 0 {
			delete(l.inProgress, tenant)
		}
	}), nil
}

package controller

import (
	"sync"
	"time"

	"k8s.io/client-go/util/workqueue"
)

type repositoryRequeue struct {
	deadline time.Time
	reason   string
}

// Scheduled reconciles outlive the failure retry budget: Forget must not discard
// a token-read continuation scheduled by an otherwise successful attempt.
type repositoryRequeueLimiter struct {
	workqueue.TypedRateLimiter[string]
	mu      sync.Mutex
	pending map[string]repositoryRequeue
}

func (r *repositoryRequeueLimiter) When(key string) time.Duration {
	delay := r.TypedRateLimiter.When(key)
	r.schedule(key, delay, "retry")
	return delay
}

func (r *repositoryRequeueLimiter) schedule(key string, delay time.Duration, reason string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.pending == nil {
		r.pending = make(map[string]repositoryRequeue)
	}
	r.pending[key] = repositoryRequeue{deadline: time.Now().Add(delay), reason: reason}
}

func (r *repositoryRequeueLimiter) delay(key string) time.Duration {
	r.mu.Lock()
	defer r.mu.Unlock()
	if pending, ok := r.pending[key]; ok {
		return time.Until(pending.deadline)
	}
	return 0
}

func (r *repositoryRequeueLimiter) take(key string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	pending := r.pending[key]
	delete(r.pending, key)
	return pending.reason
}

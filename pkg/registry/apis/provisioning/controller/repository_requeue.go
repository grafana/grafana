package controller

import (
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/workqueue"
)

type repositoryRequeue struct {
	deadline   time.Time
	reason     string
	observed   bool
	uid        types.UID
	generation int64
	deleting   bool
}

func (r repositoryRequeue) changed(obj metav1.Object) bool {
	return r.observed && (r.uid != obj.GetUID() ||
		r.generation != obj.GetGeneration() ||
		r.deleting != (obj.GetDeletionTimestamp() != nil))
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
	pending := r.pending[key]
	pending.deadline = time.Now().Add(delay)
	pending.reason = reason
	r.pending[key] = pending
}

func (r *repositoryRequeueLimiter) observe(key string, obj metav1.Object) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.pending == nil {
		r.pending = make(map[string]repositoryRequeue)
	}
	pending := r.pending[key]
	pending.observed = true
	pending.uid = obj.GetUID()
	pending.generation = obj.GetGeneration()
	pending.deleting = obj.GetDeletionTimestamp() != nil
	r.pending[key] = pending
}

func (r *repositoryRequeueLimiter) get(key string) repositoryRequeue {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.pending[key]
}

func (r *repositoryRequeueLimiter) Forget(key string) {
	r.TypedRateLimiter.Forget(key)
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.pending[key].reason != "token_wait" {
		delete(r.pending, key)
	}
}

func (r *repositoryRequeueLimiter) take(key string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	pending := r.pending[key]
	delete(r.pending, key)
	return pending.reason
}

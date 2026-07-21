package router

import (
	"context"
	"sync"
)

// Holder is a one-shot, concurrency-safe hand-off for a *Router.
//
// The Router can only be built inside the App's New() (that is where the
// kubernetes clients exist), but it is consumed elsewhere — by server.go, which
// runs the standalone proxy listener. Those happen on different goroutines with
// no guaranteed ordering, so the producer publishes via Set and consumers block
// in Get until it is available (or their context ends). Threading the same
// Holder pointer through the App's SpecificConfig is what connects the two.
type Holder struct {
	mu     sync.Mutex
	router *Router
	ready  chan struct{}
}

// NewHolder returns an empty Holder awaiting a Set.
func NewHolder() *Holder {
	return &Holder{ready: make(chan struct{})}
}

// Set publishes the Router. First write wins; later calls are ignored so a
// ret/reload path cannot swap the instance out from under a live consumer.
func (h *Holder) Set(r *Router) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.router != nil {
		return
	}
	h.router = r
	close(h.ready) // publishes h.router to every goroutine that later reads <-ready
}

// Get blocks until the Router is published or ctx ends. The returned Router is
// safe to read without further synchronization: the close(ready) in Set is
// sequenced after the write and happens-before this receive.
func (h *Holder) Get(ctx context.Context) (*Router, error) {
	select {
	case <-h.ready:
		return h.router, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

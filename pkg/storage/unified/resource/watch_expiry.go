package resource

import "sync"

// Invalidator lets notification producers report a gap in watch delivery.
type Invalidator interface {
	Invalidate()
}

// WatchInvalidator exposes the generation observed by a watch.
type WatchInvalidator interface {
	WatchInvalidation() <-chan struct{}
}

// WatchExpiry coordinates notification gaps and periodic expiry for a server.
// Each watch captures its generation before subscribing or reading a snapshot.
type WatchExpiry interface {
	WatchInvalidator
	Invalidator
}

type watchExpiry struct {
	mu         sync.Mutex
	generation chan struct{}
}

func NewWatchExpiry() WatchExpiry {
	return &watchExpiry{generation: make(chan struct{})}
}

func (e *watchExpiry) WatchInvalidation() <-chan struct{} {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.generation
}

func (e *watchExpiry) Invalidate() {
	e.mu.Lock()
	defer e.mu.Unlock()
	close(e.generation)
	e.generation = make(chan struct{})
}

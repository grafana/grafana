package kv

import (
	"context"
	"errors"
	"sync"
)

// ErrKVUnavailable is returned by EventualKVProvider.Get when the storage
// backend resolved to no local KV (e.g. storage_type=unified-grpc, or any
// other configuration that does not produce a KV on this instance).
var ErrKVUnavailable = errors.New("no KV store available in this configuration")

// EventualKVProvider is a deferred KV store reference.
//
// All methods are safe for concurrent use. Set and SetUnavailable follow
// first-call-wins semantics: once resolved, subsequent calls are no-ops.
// Callers may pass a nil *EventualKVProvider; all methods become no-ops in
// that case (and Get blocks forever — caller's ctx must be cancellable).
type EventualKVProvider struct {
	once  sync.Once
	ready chan struct{}
	store KV
}

func ProvideEventualKVStore() *EventualKVProvider {
	return &EventualKVProvider{
		ready: make(chan struct{}),
	}
}

// Set marks the provider as resolved with the given KV store and unblocks
// all Get callers. First call wins; subsequent Set or SetUnavailable calls
// are silently ignored.
func (p *EventualKVProvider) Set(store KV) {
	if p == nil {
		return
	}
	p.once.Do(func() {
		p.store = store
		close(p.ready)
	})
}

// SetUnavailable marks the provider as resolved with no KV; Get will then
// return ErrKVUnavailable. First call wins; subsequent Set or
// SetUnavailable calls are silently ignored.
func (p *EventualKVProvider) SetUnavailable() {
	if p == nil {
		return
	}
	p.once.Do(func() {
		close(p.ready)
	})
}

// Get blocks until Set or SetUnavailable is called, or until ctx is
// cancelled. Returns ErrKVUnavailable if the provider was resolved with no
// KV. On a nil receiver, blocks until ctx is cancelled.
func (p *EventualKVProvider) Get(ctx context.Context) (KV, error) {
	if p == nil {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	select {
	case <-p.ready:
		if p.store == nil {
			return nil, ErrKVUnavailable
		}
		return p.store, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

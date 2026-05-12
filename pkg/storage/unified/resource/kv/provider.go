package kv

import (
	"context"
	"errors"
)

// ErrKVUnavailable is returned by EventualKVProvider.Get when the storage
// backend resolved to no local KV (e.g. storage_type=unified-grpc, or any
// other configuration that does not produce a KV on this instance).
var ErrKVUnavailable = errors.New("no KV store available in this configuration")

// EventualKVProvider is a deferred KV store reference that blocks callers
// until the storage backend resolves. This exists because the KV store is
// created during module initialization (after Wire DI), while consumers
// may be constructed during Wire DI.
type EventualKVProvider struct {
	ready chan struct{}
	store KV
}

func ProvideEventualKVStore() *EventualKVProvider {
	return &EventualKVProvider{
		ready: make(chan struct{}),
	}
}

// Set marks the provider as resolved and unblocks all Get callers. Pass
// nil to signal that no KV is available in this configuration — Get will
// then return ErrKVUnavailable. Must be called exactly once.
func (p *EventualKVProvider) Set(store KV) {
	select {
	case <-p.ready:
		panic("EventualKVProvider.Set called more than once")
	default:
	}
	p.store = store
	close(p.ready)
}

// Get blocks until Set is called or ctx is cancelled. Returns
// ErrKVUnavailable if Set was called with a nil store.
func (p *EventualKVProvider) Get(ctx context.Context) (KV, error) {
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

package kv

import (
	"context"
	"errors"
)

// ErrKVUnavailable is returned by EventualKVProvider.Get when the storage
// backend resolved to no local KV (e.g. storage_type=unified-grpc, or any
// other configuration that does not produce a KV on this instance).
var ErrKVUnavailable = errors.New("no KV store available in this configuration")

// EventualKVProvider is a deferred KV store reference.
//
// Storage backend creation may happen during Wire DI (the Initialize path)
// or later during dskit module init (the ModuleServer path). Consumers
// wired via DI obtain the provider eagerly and call Get only when they
// actually need the KV — Get blocks until Set lands or ctx is cancelled.
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
// then return ErrKVUnavailable. Must be called exactly once; a second
// call panics ("close of closed channel").
func (p *EventualKVProvider) Set(store KV) {
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

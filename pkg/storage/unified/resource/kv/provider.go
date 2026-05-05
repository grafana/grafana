package kv

import "context"

// EventualKVProvider is a deferred KV store reference that blocks callers
// until the real store is available. This exists because the KV store is
// created during module initialization (after Wire DI), while consumers
// like the lease-based leader elector are constructed during Wire DI.
//
// Follows the same pattern as apiserver.eventualRestConfigProvider.
type EventualKVProvider struct {
	ready chan struct{}
	store KV
}

func ProvideEventualKVStore() *EventualKVProvider {
	return &EventualKVProvider{
		ready: make(chan struct{}),
	}
}

// Set makes the KV store available to all blocked Get callers. Must be
// called exactly once; subsequent calls panic.
func (p *EventualKVProvider) Set(store KV) {
	p.store = store
	close(p.ready)
}

// Get blocks until Set is called or ctx is cancelled.
func (p *EventualKVProvider) Get(ctx context.Context) (KV, error) {
	select {
	case <-p.ready:
		return p.store, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

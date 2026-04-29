package search

import (
	"context"
	"sync"
	"time"
)

// localLockBackend is a process-local lock backend for file:// snapshot buckets.
// It is intended for local development and integration tests only: locks are not
// persisted and are not coordinated across processes or hosts.
type localLockBackend struct {
	state *localLockState
	now   func() time.Time
}

type localLockState struct {
	mu    sync.Mutex
	locks map[string]lockInfo
}

var localLockRegistry = struct {
	mu      sync.Mutex
	buckets map[string]*localLockState
}{
	buckets: map[string]*localLockState{},
}

func newLocalLockBackend(registryKey string) *localLockBackend {
	localLockRegistry.mu.Lock()
	defer localLockRegistry.mu.Unlock()

	state := localLockRegistry.buckets[registryKey]
	if state == nil {
		state = &localLockState{locks: map[string]lockInfo{}}
		localLockRegistry.buckets[registryKey] = state
	}

	return &localLockBackend{
		state: state,
		now:   time.Now,
	}
}

func (b *localLockBackend) Create(ctx context.Context, key string, info lockInfo) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.state.mu.Lock()
	defer b.state.mu.Unlock()

	existing, ok := b.state.locks[key]
	if ok && b.now().Before(existing.Heartbeat.Add(existing.TTL)) {
		return errLockHeld
	}

	b.state.locks[key] = info
	return nil
}

func (b *localLockBackend) Update(ctx context.Context, key string, info lockInfo) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.state.mu.Lock()
	defer b.state.mu.Unlock()

	existing, ok := b.state.locks[key]
	if !ok {
		return errLockNotFound
	}
	if existing.Owner != info.Owner {
		return errLockHeld
	}
	if !b.now().Before(existing.Heartbeat.Add(existing.TTL)) {
		return errLeaseExpired
	}

	b.state.locks[key] = info
	return nil
}

func (b *localLockBackend) Delete(ctx context.Context, key string, owner string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.state.mu.Lock()
	defer b.state.mu.Unlock()

	existing, ok := b.state.locks[key]
	if !ok {
		return errLockNotFound
	}
	if existing.Owner != owner {
		return errLockHeld
	}

	delete(b.state.locks, key)
	return nil
}

func (b *localLockBackend) Read(ctx context.Context, key string) (*lockInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	b.state.mu.Lock()
	defer b.state.mu.Unlock()

	info, ok := b.state.locks[key]
	if !ok {
		return nil, errLockNotFound
	}
	return &info, nil
}

var _ lockBackend = (*localLockBackend)(nil)

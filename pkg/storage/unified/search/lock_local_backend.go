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
	mu    sync.Mutex
	locks map[string]lockInfo
	now   func() time.Time
}

func newLocalLockBackend() *localLockBackend {
	return &localLockBackend{
		locks: map[string]lockInfo{},
		now:   time.Now,
	}
}

func (b *localLockBackend) Create(ctx context.Context, key string, info lockInfo) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	existing, ok := b.locks[key]
	if ok && b.now().Before(existing.Heartbeat.Add(existing.TTL)) {
		return errLockHeld
	}

	b.locks[key] = info
	return nil
}

func (b *localLockBackend) Update(ctx context.Context, key string, info lockInfo) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	existing, ok := b.locks[key]
	if !ok {
		return errLockNotFound
	}
	if existing.Owner != info.Owner {
		return errLockHeld
	}
	if !b.now().Before(existing.Heartbeat.Add(existing.TTL)) {
		return errLeaseExpired
	}

	b.locks[key] = info
	return nil
}

func (b *localLockBackend) Delete(ctx context.Context, key string, owner string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	existing, ok := b.locks[key]
	if !ok {
		return errLockNotFound
	}
	if existing.Owner != owner {
		return errLockHeld
	}

	delete(b.locks, key)
	return nil
}

func (b *localLockBackend) Read(ctx context.Context, key string) (*lockInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	info, ok := b.locks[key]
	if !ok {
		return nil, errLockNotFound
	}
	return &info, nil
}

var _ lockBackend = (*localLockBackend)(nil)

package lock

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// --- ObjectStorageLock tests ---
// These test the higher-level lock API (Acquire/Release/Lost/heartbeat).
// CRUD-level tests (Create/Update/Delete/Read) are in cdk_lock_backend_test.go.
// testBackend is defined in cdk_lock_backend_test.go (same package).

func TestObjectStorageLock_AcquireRelease(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 100 * time.Millisecond,
	})
	require.NoError(t, err)

	require.NoError(t, lock.Acquire(ctx))

	info, err := backend.Read(ctx, key)
	require.NoError(t, err)
	require.Equal(t, "instance-1", info.Owner)

	require.NoError(t, lock.Release(ctx))

	_, err = backend.Read(ctx, key)
	require.ErrorIs(t, err, ErrLockNotFound)
}

func TestObjectStorageLock_Contention(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock1, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 100 * time.Millisecond,
	})
	require.NoError(t, err)
	lock2, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-2",
		TTL:               5 * time.Second,
		HeartbeatInterval: 100 * time.Millisecond,
	})
	require.NoError(t, err)

	require.NoError(t, lock1.Acquire(ctx))

	err = lock2.Acquire(ctx)
	require.ErrorIs(t, err, ErrLockHeld)

	require.NoError(t, lock1.Release(ctx))

	require.NoError(t, lock2.Acquire(ctx))
	require.NoError(t, lock2.Release(ctx))
}

func TestObjectStorageLock_Heartbeat(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 1 * time.Second,
	})
	require.NoError(t, err)

	require.NoError(t, lock.Acquire(ctx))

	// Sleep past the original TTL. If heartbeat works, the lock is still alive.
	time.Sleep(6 * time.Second)

	// Lock should not be lost.
	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost — heartbeat should have renewed it")
	default:
	}

	// Lock should still be readable with the correct owner.
	info, err := backend.Read(ctx, key)
	require.NoError(t, err)
	require.Equal(t, "instance-1", info.Owner)

	require.NoError(t, lock.Release(ctx))
}

func TestObjectStorageLock_LostChannel(t *testing.T) {
	backend := newInMemoryLockBackend()

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               100 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Delete the lock to simulate external loss.
	backend.mu.Lock()
	delete(backend.locks, "test-lock")
	backend.mu.Unlock()

	select {
	case <-lock.Lost():
		// Expected
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss to be detected")
	}
}

// --- tests that need failure injection (always use inMemoryLockBackend) ---

// failingUpdateBackend wraps inMemoryLockBackend but fails Update calls
// after a configurable number of successes.
type failingUpdateBackend struct {
	*inMemoryLockBackend
	mu            sync.Mutex
	updateCount   int
	failAfterN    int
	updateErrFunc func() error
}

func (b *failingUpdateBackend) Update(ctx context.Context, key string, info LockInfo) error {
	b.mu.Lock()
	b.updateCount++
	count := b.updateCount
	b.mu.Unlock()

	if count > b.failAfterN {
		if b.updateErrFunc != nil {
			return b.updateErrFunc()
		}
		return fmt.Errorf("simulated transient error")
	}
	return b.inMemoryLockBackend.Update(ctx, key, info)
}

// inMemoryLockBackend is a test LockBackend used by failingUpdateBackend.
type inMemoryLockBackend struct {
	mu    sync.Mutex
	locks map[string]*lockEntry
}

type lockEntry struct {
	info      LockInfo
	writeTime time.Time
}

func newInMemoryLockBackend() *inMemoryLockBackend {
	return &inMemoryLockBackend{locks: make(map[string]*lockEntry)}
}

func (b *inMemoryLockBackend) Create(_ context.Context, key string, info LockInfo) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if existing, ok := b.locks[key]; ok {
		if time.Since(existing.writeTime) < existing.info.TTL {
			return ErrLockHeld
		}
	}
	b.locks[key] = &lockEntry{info: info, writeTime: time.Now()}
	return nil
}

func (b *inMemoryLockBackend) Update(_ context.Context, key string, info LockInfo) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	existing, ok := b.locks[key]
	if !ok {
		return ErrLockNotFound
	}
	if existing.info.Owner != info.Owner {
		return ErrLockHeld
	}
	if time.Since(existing.writeTime) > existing.info.TTL {
		return ErrLeaseExpired
	}
	b.locks[key] = &lockEntry{info: info, writeTime: time.Now()}
	return nil
}

func (b *inMemoryLockBackend) Delete(_ context.Context, key string, owner string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	existing, ok := b.locks[key]
	if !ok {
		return ErrLockNotFound
	}
	if existing.info.Owner != owner {
		return ErrLockHeld
	}
	delete(b.locks, key)
	return nil
}

func (b *inMemoryLockBackend) Read(_ context.Context, key string) (*LockInfo, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	entry, ok := b.locks[key]
	if !ok {
		return nil, ErrLockNotFound
	}
	copied := entry.info
	return &copied, nil
}

func TestObjectStorageLock_ReleaseAfterHeartbeatLoss(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0,
	}

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               100 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	select {
	case <-lock.Lost():
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss")
	}

	err = lock.Release(ctx)
	require.NoError(t, err)

	_, err = memBackend.Read(ctx, "test-lock")
	require.ErrorIs(t, err, ErrLockNotFound)
}

func TestObjectStorageLock_TransientHeartbeatRecovery(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0,
	}

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               150 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Wait for the first heartbeat to fail
	time.Sleep(75 * time.Millisecond)

	// Recover
	backend.mu.Lock()
	backend.failAfterN = 100
	backend.mu.Unlock()

	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost after a single transient heartbeat failure")
	case <-time.After(200 * time.Millisecond):
	}

	require.NoError(t, lock.Release(ctx))
}

func TestObjectStorageLock_ImmediateLossOnOwnershipError(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0,
		updateErrFunc:       func() error { return ErrLockHeld },
	}

	lock, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 50 * time.Millisecond,
	})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	select {
	case <-lock.Lost():
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected immediate lock loss on ErrLockHeld, but it was not detected")
	}
}

func TestNewObjectStorageLock_RejectsNilBackend(t *testing.T) {
	_, err := NewObjectStorageLock(ObjectStorageLockConfig{
		Key:   "test-lock",
		Owner: "instance-1",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "backend must not be nil")
}

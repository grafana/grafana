package lock

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// lockEntry stores a lock alongside its server-side write time, simulating
// object storage mtime for expiry decisions (see LockBackend contract).
type lockEntry struct {
	info      LockInfo
	writeTime time.Time // simulates object mtime
}

// inMemoryLockBackend is a test implementation of LockBackend
// that simulates ETag-based atomicity using a mutex-guarded map.
// Expiry is based on writeTime (server-side mtime), not client timestamps.
type inMemoryLockBackend struct {
	mu    sync.Mutex
	locks map[string]*lockEntry
}

func newInMemoryLockBackend() *inMemoryLockBackend {
	return &inMemoryLockBackend{
		locks: make(map[string]*lockEntry),
	}
}

func (b *inMemoryLockBackend) Create(_ context.Context, key string, info LockInfo) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if existing, ok := b.locks[key]; ok {
		// Expiry based on server-side write time, not client timestamps.
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

func TestObjectStorageLock_AcquireRelease(t *testing.T) {
	backend := newInMemoryLockBackend()
	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 1 * time.Second,
	})

	ctx := context.Background()

	// Acquire
	err := lock.Acquire(ctx)
	require.NoError(t, err)

	// Verify lock is held
	info, err := backend.Read(ctx, "test-lock")
	require.NoError(t, err)
	require.Equal(t, "instance-1", info.Owner)

	// Release
	err = lock.Release(ctx)
	require.NoError(t, err)

	// Verify lock is gone
	_, err = backend.Read(ctx, "test-lock")
	require.ErrorIs(t, err, ErrLockNotFound)
}

func TestObjectStorageLock_Contention(t *testing.T) {
	backend := newInMemoryLockBackend()

	lock1 := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 1 * time.Second,
	})
	lock2 := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-2",
		TTL:               5 * time.Second,
		HeartbeatInterval: 1 * time.Second,
	})

	ctx := context.Background()

	// Lock1 acquires
	require.NoError(t, lock1.Acquire(ctx))

	// Lock2 cannot acquire
	err := lock2.Acquire(ctx)
	require.ErrorIs(t, err, ErrLockHeld)

	// Release lock1
	require.NoError(t, lock1.Release(ctx))

	// Now lock2 can acquire
	require.NoError(t, lock2.Acquire(ctx))
	require.NoError(t, lock2.Release(ctx))
}

func TestObjectStorageLock_StaleTakeover(t *testing.T) {
	backend := newInMemoryLockBackend()

	lock2 := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-2",
		TTL:               5 * time.Second,
		HeartbeatInterval: 1 * time.Second,
	})

	ctx := context.Background()

	// Simulate a crashed instance holding an expired lock.
	// writeTime is in the past so mtime + TTL < now.
	backend.mu.Lock()
	backend.locks["test-lock"] = &lockEntry{
		info: LockInfo{
			Owner: "instance-1",
			TTL:   100 * time.Millisecond,
		},
		writeTime: time.Now().Add(-200 * time.Millisecond), // already expired
	}
	backend.mu.Unlock()

	// Lock2 can take over expired lock
	require.NoError(t, lock2.Acquire(ctx))
	require.NoError(t, lock2.Release(ctx))
}

func TestObjectStorageLock_Heartbeat(t *testing.T) {
	backend := newInMemoryLockBackend()
	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 50 * time.Millisecond,
	})

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Record initial write time
	backend.mu.Lock()
	initialWriteTime := backend.locks["test-lock"].writeTime
	backend.mu.Unlock()

	// Wait for heartbeat to fire
	time.Sleep(100 * time.Millisecond)

	// Heartbeat should have updated the write time (simulating mtime refresh)
	backend.mu.Lock()
	updatedWriteTime := backend.locks["test-lock"].writeTime
	backend.mu.Unlock()
	require.True(t, updatedWriteTime.After(initialWriteTime), "heartbeat should advance server-side write time")

	require.NoError(t, lock.Release(ctx))
}

func TestObjectStorageLock_LostChannel(t *testing.T) {
	backend := newInMemoryLockBackend()
	// Use TTL = 2*heartbeat so maxFailures = 1 (loss detected after one failed heartbeat).
	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               100 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Delete the lock from the backend to simulate loss
	backend.mu.Lock()
	delete(backend.locks, "test-lock")
	backend.mu.Unlock()

	// Wait for heartbeat to detect the loss
	select {
	case <-lock.Lost():
		// Expected: lock loss detected
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss to be detected")
	}

	// Release should still attempt cleanup (held stays true after loss)
	// The delete will fail since the lock is already gone, but Release should not panic.
	err := lock.Release(ctx)
	require.Error(t, err) // backend.Delete returns ErrLockNotFound
}

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

func TestObjectStorageLock_ReleaseAfterHeartbeatLoss(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0, // fail immediately on first heartbeat
	}

	// Use TTL = 2*heartbeat so maxFailures = 1 (loss detected after one failed heartbeat).
	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               100 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Wait for lock loss
	select {
	case <-lock.Lost():
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss")
	}

	// Release should still attempt backend delete (P2 fix: held stays true).
	// The lock object is still in storage, so delete should succeed.
	err := lock.Release(ctx)
	require.NoError(t, err)

	// Lock object should be cleaned up from storage
	_, err = memBackend.Read(ctx, "test-lock")
	require.ErrorIs(t, err, ErrLockNotFound)
}

func TestObjectStorageLock_TransientHeartbeatRecovery(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	// Fail the first heartbeat, then succeed. With TTL=3*heartbeat, maxFailures=2,
	// so one transient failure should NOT trigger lock loss.
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0, // fail first heartbeat
	}

	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               150 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
	})

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Wait for the first heartbeat to fail
	time.Sleep(75 * time.Millisecond)

	// "Recover" — allow subsequent heartbeats to succeed
	backend.mu.Lock()
	backend.failAfterN = 100
	backend.mu.Unlock()

	// Lock should NOT be lost after a single transient failure
	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost after a single transient heartbeat failure")
	case <-time.After(200 * time.Millisecond):
		// Expected: lock is still held
	}

	require.NoError(t, lock.Release(ctx))
}

func TestObjectStorageLock_ImmediateLossOnOwnershipError(t *testing.T) {
	memBackend := newInMemoryLockBackend()
	// Return ErrLockHeld on first heartbeat (simulates another owner took over).
	backend := &failingUpdateBackend{
		inMemoryLockBackend: memBackend,
		failAfterN:          0,
		updateErrFunc:       func() error { return ErrLockHeld },
	}

	// Use high TTL/heartbeat ratio — if ownership errors were treated as transient,
	// it would take many retries before declaring loss.
	lock := NewObjectStorageLock(ObjectStorageLockConfig{
		Backend:           backend,
		Key:               "test-lock",
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 50 * time.Millisecond,
	})

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Lock loss should be detected immediately (within one heartbeat interval),
	// not after maxFailures (99) retries.
	select {
	case <-lock.Lost():
		// Expected: immediate loss on ownership error
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected immediate lock loss on ErrLockHeld, but it was not detected")
	}
}

package lock

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// --- ObjectStorageLock tests ---
// These test the higher-level lock API (Acquire/Release/Lost/heartbeat).
// CRUD-level tests are in cdk_lock_backend_test.go.

func TestObjectStorageLock_AcquireRelease(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock, err := newObjectStorageLock(objectStorageLockConfig{
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

	require.NoError(t, lock.Release())

	_, err = backend.Read(ctx, key)
	require.ErrorIs(t, err, errLockNotFound)
}

func TestObjectStorageLock_Contention(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock1, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-1",
		TTL:               5 * time.Second,
		HeartbeatInterval: 100 * time.Millisecond,
	})
	require.NoError(t, err)
	lock2, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-2",
		TTL:               5 * time.Second,
		HeartbeatInterval: 100 * time.Millisecond,
	})
	require.NoError(t, err)

	require.NoError(t, lock1.Acquire(ctx))

	err = lock2.Acquire(ctx)
	require.ErrorIs(t, err, errLockHeld)

	require.NoError(t, lock1.Release())

	require.NoError(t, lock2.Acquire(ctx))
	require.NoError(t, lock2.Release())
}

func TestObjectStorageLock_Heartbeat(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	ttl := 500 * time.Millisecond
	hbInterval := 100 * time.Millisecond
	if os.Getenv("CDK_TEST_BUCKET_URL") != "" {
		ttl = 5 * time.Second
		hbInterval = 1 * time.Second
	}

	lock, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             "instance-1",
		TTL:               ttl,
		HeartbeatInterval: hbInterval,
	})
	require.NoError(t, err)

	require.NoError(t, lock.Acquire(ctx))

	// Sleep past the original TTL. If heartbeat works, the lock is still alive.
	time.Sleep(ttl + hbInterval)

	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost — heartbeat should have renewed it")
	default:
	}

	info, err := backend.Read(ctx, key)
	require.NoError(t, err)
	require.Equal(t, "instance-1", info.Owner)

	require.NoError(t, lock.Release())
}

func TestObjectStorageLock_LostChannel(t *testing.T) {
	backend := newFakeBackend(newConditionalBucket())

	lock, err := newObjectStorageLock(objectStorageLockConfig{
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
	require.NoError(t, backend.Delete(ctx, "test-lock", "instance-1"))

	select {
	case <-lock.Lost():
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss to be detected")
	}
}

func TestNewObjectStorageLock_RejectsNilBackend(t *testing.T) {
	_, err := newObjectStorageLock(objectStorageLockConfig{
		Key:   "test-lock",
		Owner: "instance-1",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "backend must not be nil")
}

// --- tests that need failure injection ---

func TestObjectStorageLock_ReleaseAfterHeartbeatLoss(t *testing.T) {
	inner := newFakeBackend(newConditionalBucket())
	backend := &failingUpdateBackend{
		lockBackend: inner,
		failAfterN:  0,
	}

	lock, err := newObjectStorageLock(objectStorageLockConfig{
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

	err = lock.Release()
	require.NoError(t, err)

	_, err = backend.Read(ctx, "test-lock")
	require.ErrorIs(t, err, errLockNotFound)
}

func TestObjectStorageLock_TransientHeartbeatRecovery(t *testing.T) {
	backend := &failingUpdateBackend{
		lockBackend: newFakeBackend(newConditionalBucket()),
		failAfterN:  0,
	}

	lock, err := newObjectStorageLock(objectStorageLockConfig{
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

	require.NoError(t, lock.Release())
}

func TestObjectStorageLock_ImmediateLossOnOwnershipError(t *testing.T) {
	backend := &failingUpdateBackend{
		lockBackend:   newFakeBackend(newConditionalBucket()),
		failAfterN:    0,
		updateErrFunc: func() error { return errLockHeld },
	}

	lock, err := newObjectStorageLock(objectStorageLockConfig{
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
		t.Fatal("expected immediate lock loss on errLockHeld, but it was not detected")
	}
}

// failingUpdateBackend wraps a lockBackend and fails Update calls
// after a configurable number of successes.
type failingUpdateBackend struct {
	lockBackend
	mu            sync.Mutex
	updateCount   int
	failAfterN    int
	updateErrFunc func() error
}

func (b *failingUpdateBackend) Update(ctx context.Context, key string, info lockInfo) error {
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
	return b.lockBackend.Update(ctx, key, info)
}

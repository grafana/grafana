package search

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

// newTestLock constructs an objectStorageLock with the given backend and timings.
func newTestLock(t *testing.T, backend lockBackend, key, owner string, ttl, hbInterval time.Duration) *objectStorageLock {
	t.Helper()
	lock, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           backend,
		Key:               key,
		Owner:             owner,
		TTL:               ttl,
		HeartbeatInterval: hbInterval,
	})
	require.NoError(t, err)
	return lock
}

func TestObjectStorageLock_AcquireRelease(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)

	lock := newTestLock(t, backend, key, "instance-1", 5*time.Second, 100*time.Millisecond)

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

	lock1 := newTestLock(t, backend, key, "instance-1", 5*time.Second, 100*time.Millisecond)
	lock2 := newTestLock(t, backend, key, "instance-2", 5*time.Second, 100*time.Millisecond)

	require.NoError(t, lock1.Acquire(ctx))

	err := lock2.Acquire(ctx)
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

	lock := newTestLock(t, backend, key, "instance-1", ttl, hbInterval)

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

	lock := newTestLock(t, backend, "test-lock", "instance-1", 100*time.Millisecond, 50*time.Millisecond)

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

func TestNewObjectStorageLock_Validation(t *testing.T) {
	backend := newFakeBackend(newConditionalBucket())
	validKey := "test-lock"

	tests := []struct {
		name    string
		cfg     objectStorageLockConfig
		wantErr string
		wantIs  error // optional sentinel
	}{
		{
			name:    "nil backend",
			cfg:     objectStorageLockConfig{Key: validKey, Owner: "instance-1"},
			wantErr: "backend must not be nil",
		},
		{
			name:    "empty owner",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: ""},
			wantErr: "owner must not be empty",
		},
		{
			name:   "invalid key",
			cfg:    objectStorageLockConfig{Backend: backend, Key: "bad#key", Owner: "instance-1"},
			wantIs: errInvalidLockKey,
		},
		{
			name:    "negative TTL",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: "instance-1", TTL: -1 * time.Second},
			wantErr: "TTL must be positive",
		},
		{
			name:    "negative HeartbeatInterval",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: "instance-1", TTL: time.Second, HeartbeatInterval: -1 * time.Millisecond},
			wantErr: "HeartbeatInterval must be positive",
		},
		{
			name:    "TTL less than 2x HeartbeatInterval",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: "instance-1", TTL: 100 * time.Millisecond, HeartbeatInterval: 75 * time.Millisecond},
			wantErr: "at least 2x HeartbeatInterval",
		},
		{
			name:    "negative HeartbeatUpdateTimeout",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: "instance-1", TTL: time.Second, HeartbeatInterval: 100 * time.Millisecond, HeartbeatUpdateTimeout: -1 * time.Millisecond},
			wantErr: "HeartbeatUpdateTimeout must be positive",
		},
		{
			name:    "negative ReleaseDeleteTimeout",
			cfg:     objectStorageLockConfig{Backend: backend, Key: validKey, Owner: "instance-1", TTL: time.Second, HeartbeatInterval: 100 * time.Millisecond, ReleaseDeleteTimeout: -1 * time.Millisecond},
			wantErr: "ReleaseDeleteTimeout must be positive",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newObjectStorageLock(tc.cfg)
			require.Error(t, err)
			if tc.wantIs != nil {
				require.ErrorIs(t, err, tc.wantIs)
			}
			if tc.wantErr != "" {
				require.Contains(t, err.Error(), tc.wantErr)
			}
		})
	}
}

// --- tests that need failure injection ---

func TestObjectStorageLock_ReleaseAfterHeartbeatLoss(t *testing.T) {
	inner := newFakeBackend(newConditionalBucket())
	backend := &failingUpdateBackend{
		lockBackend: inner,
		failAfterN:  0,
	}

	lock := newTestLock(t, backend, "test-lock", "instance-1", 100*time.Millisecond, 50*time.Millisecond)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	select {
	case <-lock.Lost():
	case <-time.After(1 * time.Second):
		t.Fatal("expected lock loss")
	}

	require.NoError(t, lock.Release())

	_, err := backend.Read(ctx, "test-lock")
	require.ErrorIs(t, err, errLockNotFound)
}

func TestObjectStorageLock_TransientHeartbeatRecovery(t *testing.T) {
	backend := &failingUpdateBackend{
		lockBackend: newFakeBackend(newConditionalBucket()),
		failAfterN:  0,
	}

	lock := newTestLock(t, backend, "test-lock", "instance-1", 150*time.Millisecond, 50*time.Millisecond)

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

// TestObjectStorageLock_ReleaseWaitsForInFlightUpdate locks in the design decision
// that heartbeat Update uses context.Background(): Release must wait for an
// in-flight Update to finish before issuing Delete, and must not fire Lost.
// A future change that re-wires updateCtx to hbCtx would fail this test.
func TestObjectStorageLock_ReleaseWaitsForInFlightUpdate(t *testing.T) {
	inner := newFakeBackend(newConditionalBucket())
	backend := &slowUpdateBackend{
		lockBackend:   inner,
		updateStarted: make(chan struct{}),
		release:       make(chan struct{}),
	}

	lock := newTestLock(t, backend, "test-lock", "instance-1", 300*time.Millisecond, 50*time.Millisecond)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	// Wait for the first heartbeat tick to enter Update (and block there).
	select {
	case <-backend.updateStarted:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected heartbeat Update to start")
	}

	// Release must wait for the in-flight Update to complete.
	released := make(chan error, 1)
	go func() { released <- lock.Release() }()

	select {
	case err := <-released:
		t.Fatalf("Release returned while Update was still in flight: %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	// And must not fire Lost during the wait.
	select {
	case <-lock.Lost():
		t.Fatal("Lost signalled while Release was waiting on in-flight Update")
	default:
	}

	close(backend.release)

	select {
	case err := <-released:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("Release did not return after Update completed")
	}

	_, err := inner.Read(ctx, "test-lock")
	require.ErrorIs(t, err, errLockNotFound)

	select {
	case <-lock.Lost():
		t.Fatal("Lost signalled after successful Release")
	default:
	}
}

// TestObjectStorageLock_HeartbeatLossDetectedBeforeTTL asserts that with all
// heartbeats failing transiently, lostCh fires before the lease expires
// server-side. See the maxFailures comment in runHeartbeat for the rationale.
func TestObjectStorageLock_HeartbeatLossDetectedBeforeTTL(t *testing.T) {
	backend := &failingUpdateBackend{
		lockBackend: newFakeBackend(newConditionalBucket()),
		failAfterN:  0,
	}

	// 3:1 ratio mirrors the production default (180s/60s). Absolute times are
	// scaled up so scheduler jitter and GC pauses on slow CI runners don't eat
	// the safety margin we're trying to assert.
	ttl := 900 * time.Millisecond
	hbi := 300 * time.Millisecond
	lock := newTestLock(t, backend, "test-lock", "instance-1", ttl, hbi)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))
	start := time.Now()

	select {
	case <-lock.Lost():
	case <-time.After(ttl + 300*time.Millisecond):
		t.Fatal("expected lock loss")
	}

	elapsed := time.Since(start)
	// Loss should fire ~one heartbeat before TTL (~600ms here, vs the 900ms lease).
	require.Less(t, elapsed, ttl-hbi/2, "loss should be detected with safety margin before TTL (got %s, ttl=%s)", elapsed, ttl)
}

func TestObjectStorageLock_ImmediateLossOnOwnershipError(t *testing.T) {
	backend := &failingUpdateBackend{
		lockBackend:   newFakeBackend(newConditionalBucket()),
		failAfterN:    0,
		updateErrFunc: func() error { return errLockHeld },
	}

	lock := newTestLock(t, backend, "test-lock", "instance-1", 5*time.Second, 50*time.Millisecond)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))

	select {
	case <-lock.Lost():
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected immediate lock loss on errLockHeld, but it was not detected")
	}
}

// TestObjectStorageLock_HeartbeatUpdateTimeoutHonored asserts that the
// configured HeartbeatUpdateTimeout caps each heartbeat Update call. Without
// a configurable knob this defaulted to 30s, which made Release block up to
// 30s on shutdown if a heartbeat tick was in flight.
func TestObjectStorageLock_HeartbeatUpdateTimeoutHonored(t *testing.T) {
	inner := newFakeBackend(newConditionalBucket())
	backend := &ctxRespectingBlockingBackend{
		lockBackend:    inner,
		updateDuration: make(chan time.Duration, 1),
	}

	configuredTimeout := 100 * time.Millisecond
	lock, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:                backend,
		Key:                    "test-lock",
		Owner:                  "instance-1",
		TTL:                    1 * time.Second,
		HeartbeatInterval:      50 * time.Millisecond,
		HeartbeatUpdateTimeout: configuredTimeout,
	})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, lock.Acquire(ctx))
	t.Cleanup(func() { _ = lock.Release() })

	select {
	case d := <-backend.updateDuration:
		// Heartbeat Update returned within the configured timeout, not the 30s default.
		require.GreaterOrEqual(t, d, configuredTimeout-20*time.Millisecond)
		require.Less(t, d, configuredTimeout+200*time.Millisecond)
	case <-time.After(2 * time.Second):
		t.Fatal("expected heartbeat Update to return within configured timeout")
	}
}

// ctxRespectingBlockingBackend blocks Update on ctx.Done() and reports the
// elapsed time on updateDuration. Used to verify that callers honor the
// timeout context they pass in.
type ctxRespectingBlockingBackend struct {
	lockBackend
	updateDuration chan time.Duration
}

func (b *ctxRespectingBlockingBackend) Update(ctx context.Context, _ string, _ lockInfo) error {
	start := time.Now()
	<-ctx.Done()
	select {
	case b.updateDuration <- time.Since(start):
	default:
	}
	return ctx.Err()
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

// slowUpdateBackend blocks the first Update on a release channel, so tests
// can exercise Release's wait-for-in-flight-Update contract.
type slowUpdateBackend struct {
	lockBackend
	updateStarted chan struct{} // closed when the first Update enters
	release       chan struct{} // close to let the blocked Update proceed
	once          sync.Once
}

func (b *slowUpdateBackend) Update(ctx context.Context, key string, info lockInfo) error {
	b.once.Do(func() { close(b.updateStarted) })
	<-b.release
	return b.lockBackend.Update(ctx, key, info)
}

func (b *failingUpdateBackend) Update(ctx context.Context, key string, info lockInfo) error {
	b.mu.Lock()
	b.updateCount++
	shouldFail := b.updateCount > b.failAfterN
	errFunc := b.updateErrFunc
	b.mu.Unlock()

	if shouldFail {
		if errFunc != nil {
			return errFunc()
		}
		return fmt.Errorf("simulated transient error")
	}
	return b.lockBackend.Update(ctx, key, info)
}

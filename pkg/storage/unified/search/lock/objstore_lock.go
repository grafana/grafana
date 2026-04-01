package lock

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// LockInfo contains the metadata for a distributed lock.
// Expiry is NOT determined from fields in this struct. Backends must use
// the object's server-side last-modified timestamp (mtime) to decide whether
// a lock has expired, avoiding clock-skew issues between Grafana instances.
type LockInfo struct {
	Owner     string        `json:"owner"`
	TTL       time.Duration `json:"ttl"`
	Heartbeat time.Time     `json:"heartbeat"` // informational: when the owner last wrote; expiry uses mtime, not this field
}

// LockBackend abstracts conditional storage operations for distributed locking.
// Production implementations use ETag-based conditional writes on S3/GCS/Azure.
// Test implementations use an in-memory mutex-guarded map.
//
// Expiry: backends must determine lock expiry from the object's server-side
// last-modified timestamp (mtime), NOT from any client-supplied timestamp.
// This avoids clock-skew problems between Grafana instances. A lock is expired
// when mtime + TTL < now (using the storage service's clock).
type LockBackend interface {
	// Create atomically creates a lock if it does not exist.
	// Returns ErrLockHeld if lock already exists and is not expired.
	// Expiry must be computed from the object's server-side mtime + TTL.
	Create(ctx context.Context, key string, info LockInfo) error

	// Update atomically updates an existing lock, verifying ownership.
	// Returns error if lock does not exist or is owned by a different owner.
	Update(ctx context.Context, key string, info LockInfo) error

	// Delete atomically deletes a lock, verifying ownership.
	// Returns error if lock does not exist or is owned by a different owner.
	Delete(ctx context.Context, key string, owner string) error

	// Read returns the current lock info, or ErrLockNotFound if no lock exists.
	Read(ctx context.Context, key string) (*LockInfo, error)
}

// ErrLockHeld is returned when a lock cannot be acquired because it is held by another owner.
var ErrLockHeld = errors.New("lock is held by another owner")

// ErrLockNotFound is returned when a lock operation targets a non-existent lock.
var ErrLockNotFound = errors.New("lock not found")

// ErrPreconditionFailed indicates a conditional operation failed because the object
// was modified concurrently. ConditionalDeleteFunc implementations must return this
// (via fmt.Errorf wrapping) so CDKLockBackend can distinguish races from other errors.
var ErrPreconditionFailed = errors.New("precondition failed")

// ObjectStorageLock provides distributed locking via conditional object storage writes.
type ObjectStorageLock struct {
	backend           LockBackend
	key               string
	owner             string
	ttl               time.Duration
	heartbeatInterval time.Duration

	mu       sync.Mutex
	held     bool
	cancelHB context.CancelFunc
	hbDone   chan struct{}

	lostCh chan struct{}
}

// ObjectStorageLockConfig holds configuration for creating an ObjectStorageLock.
type ObjectStorageLockConfig struct {
	Backend           LockBackend
	Key               string
	Owner             string
	TTL               time.Duration // Default: 180s
	HeartbeatInterval time.Duration // Default: 60s
}

// NewObjectStorageLock creates a new distributed lock.
// Panics if HeartbeatInterval >= TTL, since the lease would expire before
// the first heartbeat renewal.
func NewObjectStorageLock(cfg ObjectStorageLockConfig) *ObjectStorageLock {
	if cfg.TTL == 0 {
		cfg.TTL = 180 * time.Second
	}
	if cfg.HeartbeatInterval == 0 {
		cfg.HeartbeatInterval = 60 * time.Second
	}
	if cfg.HeartbeatInterval >= cfg.TTL {
		panic(fmt.Sprintf("HeartbeatInterval (%s) must be less than TTL (%s)", cfg.HeartbeatInterval, cfg.TTL))
	}
	return &ObjectStorageLock{
		backend:           cfg.Backend,
		key:               cfg.Key,
		owner:             cfg.Owner,
		ttl:               cfg.TTL,
		heartbeatInterval: cfg.HeartbeatInterval,
		lostCh:            make(chan struct{}),
	}
}

// Lost returns a channel that is closed if the lock is lost due to a heartbeat failure.
// Callers holding the lock should select on this channel to detect lock loss.
func (l *ObjectStorageLock) Lost() <-chan struct{} {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.lostCh
}

// Acquire attempts to acquire the distributed lock.
// If the lock is held by another owner and not expired, returns ErrLockHeld.
// Starts a background heartbeat goroutine on success.
func (l *ObjectStorageLock) Acquire(ctx context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.held {
		return fmt.Errorf("lock already held by this instance")
	}

	info := LockInfo{
		Owner:     l.owner,
		TTL:       l.ttl,
		Heartbeat: time.Now(),
	}

	if err := l.backend.Create(ctx, l.key, info); err != nil {
		return err
	}

	l.held = true
	l.lostCh = make(chan struct{})
	l.startHeartbeat()
	return nil
}

// Release releases the distributed lock and stops the heartbeat goroutine.
func (l *ObjectStorageLock) Release(ctx context.Context) error {
	l.mu.Lock()
	if !l.held {
		l.mu.Unlock()
		return nil
	}
	// Cancel heartbeat context first, then drop the mutex so the goroutine
	// can acquire it if needed during its shutdown path.
	if l.cancelHB != nil {
		l.cancelHB()
	}
	// Capture hbDone under the lock to avoid a data race.
	hbDone := l.hbDone
	l.mu.Unlock()

	// Wait for heartbeat goroutine outside the lock to avoid deadlock.
	if hbDone != nil {
		<-hbDone
	}

	err := l.backend.Delete(ctx, l.key, l.owner)

	l.mu.Lock()
	l.cancelHB = nil
	l.hbDone = nil
	if err == nil || errors.Is(err, ErrLockNotFound) || errors.Is(err, ErrLockHeld) {
		// Clear held on success, or when the lock is already gone / taken by
		// another owner. In those cases this instance no longer owns anything,
		// and keeping held=true would block future Acquire calls.
		l.held = false
	}
	// On transient storage errors, keep held=true so the caller can retry Release.
	l.mu.Unlock()

	return err
}

func (l *ObjectStorageLock) startHeartbeat() {
	ctx, cancel := context.WithCancel(context.Background())
	l.cancelHB = cancel
	l.hbDone = make(chan struct{})

	go func() {
		defer close(l.hbDone)
		ticker := time.NewTicker(l.heartbeatInterval)
		defer ticker.Stop()

		// Allow consecutive transient failures before declaring loss.
		// With 60s heartbeat and 180s TTL, maxFailures=2 means we tolerate
		// up to 120s of outage while still having TTL margin.
		maxFailures := int(l.ttl/l.heartbeatInterval) - 1
		if maxFailures < 1 {
			maxFailures = 1
		}
		consecutiveFailures := 0

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				info := LockInfo{
					Owner:     l.owner,
					TTL:       l.ttl,
					Heartbeat: time.Now(),
				}
				if err := l.backend.Update(ctx, l.key, info); err != nil {
					// Release() cancels our context; if the ticker fires at
					// the same instant, Update sees context.Canceled. That is
					// a graceful shutdown, not lock loss — let ctx.Done() win.
					if ctx.Err() != nil {
						return
					}
					// Definitive loss: another owner took the lock or it was deleted.
					if errors.Is(err, ErrLockHeld) || errors.Is(err, ErrLockNotFound) {
						l.mu.Lock()
						close(l.lostCh)
						l.mu.Unlock()
						return
					}
					// Transient error — retry on next tick, give up after maxFailures.
					consecutiveFailures++
					if consecutiveFailures >= maxFailures {
						l.mu.Lock()
						close(l.lostCh)
						l.mu.Unlock()
						return
					}
					continue
				}
				consecutiveFailures = 0
			}
		}
	}()
}

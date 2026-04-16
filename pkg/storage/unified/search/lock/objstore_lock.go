package lock

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

// LockInfo contains the metadata for a distributed lock.
type LockInfo struct {
	Owner     string        `json:"owner"`
	TTL       time.Duration `json:"ttl"`
	Heartbeat time.Time     `json:"heartbeat"` // informational: when the owner last renewed the lock
}

// LockBackend is the storage primitive for distributed locking.
// Implementations provide atomic create, conditional update, conditional delete, and read operations.
type LockBackend interface {
	// Create atomically creates a lock if it does not exist.
	// Returns ErrLockHeld if the lock already exists and has not expired.
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

// ErrLeaseExpired is returned when a lock owner attempts to renew a lease that has already expired.
var ErrLeaseExpired = errors.New("lease expired")

// ErrInvalidLockKey is returned when a lock key contains characters unsafe for object storage providers.
var ErrInvalidLockKey = errors.New("invalid lock key")

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
// Returns an error if TTL < 2*HeartbeatInterval. This guarantees at least one
// full heartbeat interval of margin between loss detection and lease expiry.
func NewObjectStorageLock(cfg ObjectStorageLockConfig) (*ObjectStorageLock, error) {
	if cfg.TTL == 0 {
		cfg.TTL = 180 * time.Second
	}
	if cfg.HeartbeatInterval == 0 {
		cfg.HeartbeatInterval = 60 * time.Second
	}
	if cfg.Backend == nil {
		return nil, fmt.Errorf("backend must not be nil")
	}
	if cfg.Owner == "" {
		return nil, fmt.Errorf("owner must not be empty")
	}
	if cfg.TTL <= 0 {
		return nil, fmt.Errorf("TTL must be positive, got %s", cfg.TTL)
	}
	if cfg.HeartbeatInterval <= 0 {
		return nil, fmt.Errorf("HeartbeatInterval must be positive, got %s", cfg.HeartbeatInterval)
	}
	if cfg.TTL < 2*cfg.HeartbeatInterval {
		return nil, fmt.Errorf("TTL (%s) must be at least 2x HeartbeatInterval (%s)", cfg.TTL, cfg.HeartbeatInterval)
	}
	return &ObjectStorageLock{
		backend:           cfg.Backend,
		key:               cfg.Key,
		owner:             cfg.Owner,
		ttl:               cfg.TTL,
		heartbeatInterval: cfg.HeartbeatInterval,
		lostCh:            make(chan struct{}),
	}, nil
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

	// Use a fresh context for the delete so a canceled caller context
	// (e.g. request-scoped) doesn't leave the lock object behind.
	deleteCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	err := l.backend.Delete(deleteCtx, l.key, l.owner)

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

		// Tolerate transient failures up to the lease boundary. Genuine expiry
		// is caught by Update returning ErrLeaseExpired (definitive loss).
		maxFailures := int(math.Ceil(float64(l.ttl) / float64(l.heartbeatInterval)))
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
				updateCtx, updateCancel := context.WithTimeout(context.Background(), 30*time.Second)
				err := l.backend.Update(updateCtx, l.key, info)
				updateCancel()
				if err != nil {
					// Release() cancels our loop context — check if we should stop.
					if ctx.Err() != nil {
						return
					}
					// Definitive loss: another owner took the lock, it was deleted, or our lease expired.
					if errors.Is(err, ErrLockHeld) || errors.Is(err, ErrLockNotFound) || errors.Is(err, ErrLeaseExpired) {
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

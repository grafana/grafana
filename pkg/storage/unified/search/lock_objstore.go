package search

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// lockInfo contains the metadata for a distributed lock.
type lockInfo struct {
	Owner     string        `json:"owner"`
	TTL       time.Duration `json:"ttl"`
	Heartbeat time.Time     `json:"heartbeat"` // informational: when the owner last renewed the lock
}

// lockBackend is the storage primitive for distributed locking.
// Implementations provide atomic create, conditional update, conditional delete, and read operations.
type lockBackend interface {
	// Create atomically creates a lock if it does not exist.
	// Returns errLockHeld if the lock already exists and has not expired.
	Create(ctx context.Context, key string, info lockInfo) error

	// Update atomically updates an existing lock, verifying ownership.
	// Returns error if lock does not exist or is owned by a different owner.
	Update(ctx context.Context, key string, info lockInfo) error

	// Delete atomically deletes a lock, verifying ownership.
	// Returns error if lock does not exist or is owned by a different owner.
	Delete(ctx context.Context, key string, owner string) error

	// Read returns the current lock info, or errLockNotFound if no lock exists.
	Read(ctx context.Context, key string) (*lockInfo, error)
}

// errLockHeld is returned when a lock cannot be acquired because it is held by another owner.
var errLockHeld = errors.New("lock is held by another owner")

// errLockNotFound is returned when a lock operation targets a non-existent lock.
var errLockNotFound = errors.New("lock not found")

// errLeaseExpired is returned when a lock owner attempts to renew a lease that has already expired.
var errLeaseExpired = errors.New("lease expired")

// errInvalidLockKey is returned when a lock key contains characters unsafe for object storage providers.
var errInvalidLockKey = errors.New("invalid lock key")

// objectStorageLock provides distributed locking via conditional object storage writes.
//
// Not safe for concurrent use from the caller side. A single goroutine should
// call Acquire, then either Release or consume Lost(). The internal heartbeat
// goroutine only touches immutable config and closes lostCh.
type objectStorageLock struct {
	// Immutable after construction.
	backend                lockBackend
	key                    string
	owner                  string
	ttl                    time.Duration
	heartbeatInterval      time.Duration
	heartbeatUpdateTimeout time.Duration
	releaseDeleteTimeout   time.Duration

	held     bool
	hbCancel context.CancelFunc
	hbDone   chan struct{}

	// lostCh is created in Acquire and only closed by the heartbeat goroutine.
	lostCh chan struct{}
}

// objectStorageLockConfig holds configuration for creating an objectStorageLock.
type objectStorageLockConfig struct {
	Backend           lockBackend
	Key               string
	Owner             string
	TTL               time.Duration // Default: 180s
	HeartbeatInterval time.Duration // Default: 60s
	// HeartbeatUpdateTimeout caps each heartbeat Update call. It also bounds how
	// long Release blocks waiting for an in-flight Update to complete (the
	// heartbeat uses context.Background() for the Update itself to avoid a GCS
	// conditional-write race; see runHeartbeat). Default: 30s.
	HeartbeatUpdateTimeout time.Duration
	// ReleaseDeleteTimeout caps the conditional Delete call performed by
	// Release. Default: 30s.
	ReleaseDeleteTimeout time.Duration
}

// newObjectStorageLock creates a new distributed lock.
func newObjectStorageLock(cfg objectStorageLockConfig) (*objectStorageLock, error) {
	if cfg.TTL == 0 {
		cfg.TTL = 180 * time.Second
	}
	if cfg.HeartbeatInterval == 0 {
		cfg.HeartbeatInterval = 60 * time.Second
	}
	if cfg.HeartbeatUpdateTimeout == 0 {
		cfg.HeartbeatUpdateTimeout = 30 * time.Second
	}
	if cfg.ReleaseDeleteTimeout == 0 {
		cfg.ReleaseDeleteTimeout = 30 * time.Second
	}
	if cfg.Backend == nil {
		return nil, fmt.Errorf("backend must not be nil")
	}
	if cfg.Owner == "" {
		return nil, fmt.Errorf("owner must not be empty")
	}
	if err := validateObjectKey(cfg.Key); err != nil {
		return nil, err
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
	if cfg.HeartbeatUpdateTimeout <= 0 {
		return nil, fmt.Errorf("HeartbeatUpdateTimeout must be positive, got %s", cfg.HeartbeatUpdateTimeout)
	}
	if cfg.ReleaseDeleteTimeout <= 0 {
		return nil, fmt.Errorf("ReleaseDeleteTimeout must be positive, got %s", cfg.ReleaseDeleteTimeout)
	}
	return &objectStorageLock{
		backend:                cfg.Backend,
		key:                    cfg.Key,
		owner:                  cfg.Owner,
		ttl:                    cfg.TTL,
		heartbeatInterval:      cfg.HeartbeatInterval,
		heartbeatUpdateTimeout: cfg.HeartbeatUpdateTimeout,
		releaseDeleteTimeout:   cfg.ReleaseDeleteTimeout,
		lostCh:                 make(chan struct{}),
	}, nil
}

// Lost returns a channel that is closed if the lock is lost due to a heartbeat failure.
// Callers may call Release after losing the lock to attempt a cleanup of the lock object.
func (l *objectStorageLock) Lost() <-chan struct{} {
	return l.lostCh
}

// Acquire attempts to acquire the distributed lock.
// If the lock is held by another owner and not expired, returns errLockHeld.
// Starts a background heartbeat goroutine on success.
func (l *objectStorageLock) Acquire(ctx context.Context) error {
	if l.held {
		return fmt.Errorf("lock already held by this instance")
	}

	info := lockInfo{
		Owner:     l.owner,
		TTL:       l.ttl,
		Heartbeat: time.Now(),
	}

	if err := l.backend.Create(ctx, l.key, info); err != nil {
		return err
	}

	l.held = true
	l.lostCh = make(chan struct{})

	hbCtx, cancel := context.WithCancel(context.Background())
	l.hbCancel = cancel
	l.hbDone = make(chan struct{})
	go l.runHeartbeat(hbCtx, l.hbDone)
	return nil
}

// Release stops the heartbeat and deletes the lock object.
// Non-retriable errors: errLockHeld, errLockNotFound
func (l *objectStorageLock) Release() error {
	if !l.held {
		return nil
	}
	l.hbCancel()
	<-l.hbDone

	ctx, cancel := context.WithTimeout(context.Background(), l.releaseDeleteTimeout)
	defer cancel()
	err := l.backend.Delete(ctx, l.key, l.owner)
	if err == nil || errors.Is(err, errLockNotFound) || errors.Is(err, errLockHeld) {
		l.held = false
	}
	// On transient Delete errors, keep held=true so a retry re-enters this path
	// and re-attempts the Delete. hbCancel() and <-hbDone are both idempotent.
	return err
}

func (l *objectStorageLock) runHeartbeat(ctx context.Context, done chan struct{}) {
	defer close(done)
	ticker := time.NewTicker(l.heartbeatInterval)
	defer ticker.Stop()

	// Tolerate transient failures up to the lease boundary.
	// Floor ensures loss is detected no later than TTL
	maxFailures := int(l.ttl / l.heartbeatInterval)
	consecutiveFailures := 0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			info := lockInfo{
				Owner:     l.owner,
				TTL:       l.ttl,
				Heartbeat: time.Now(),
			}
			// Heartbeat Update uses context.Background() — intentionally NOT derived
			// from ctx — so Release's cancel doesn't abort an in-flight Update. On
			// GCS, a cancelled-but-committed Update can leave the object at a new
			// ETag server-side, which would then mismatch Release's conditional
			// Delete and surface as errPreconditionFailed. Tradeoff: hbCancel() +
			// <-hbDone in Release can block up to heartbeatUpdateTimeout if a tick
			// is in flight. See also the ctx.Err() != nil guard below, which
			// prevents the goroutine from signalling Lost when Release is the
			// reason we're exiting.
			updateCtx, updateCancel := context.WithTimeout(context.Background(), l.heartbeatUpdateTimeout)
			err := l.backend.Update(updateCtx, l.key, info)
			updateCancel()
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				// Definitive loss: another owner took the lock, it was deleted, or our lease expired.
				if errors.Is(err, errLockHeld) || errors.Is(err, errLockNotFound) || errors.Is(err, errLeaseExpired) {
					close(l.lostCh)
					return
				}
				// Transient error — retry on next tick, give up after maxFailures.
				consecutiveFailures++
				if consecutiveFailures >= maxFailures {
					close(l.lostCh)
					return
				}
				continue
			}
			consecutiveFailures = 0
		}
	}
}

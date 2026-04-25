package lease

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// defaultTTL is the TTL applied when an Acquire call does not pass WithTTL.
const defaultTTL = 10 * time.Second

var (
	// ErrLeaseAlreadyHeld is returned by Acquire when an unexpired lease for
	// the requested name is already owned (by any holder, including the
	// caller).
	ErrLeaseAlreadyHeld = errors.New("lease already held")

	// ErrLeaseLost is returned by Release when the lease being released is no
	// longer owned by the caller — typically because it has expired or has
	// already been released.
	ErrLeaseLost = errors.New("lease lost")
)

type Lease struct {
	name       string
	holder     string
	generation int64
}

// Manager acquires and releases leases backed by a KV store.
type Manager struct {
	store  kv.KV
	holder string
}

// NewManager returns a Manager that uses store for persistence and identifies
// itself as holder.
func NewManager(store kv.KV, holder string) *Manager {
	return &Manager{store: store, holder: holder}
}

// AcquireOption configures a single Acquire call.
type AcquireOption func(*acquireOptions)

type acquireOptions struct {
	ttl time.Duration
}

// WithTTL overrides the default lease TTL for this acquisition.
func WithTTL(d time.Duration) AcquireOption {
	return func(o *acquireOptions) { o.ttl = d }
}

// Acquire grabs the lease for `name` on behalf of the manager's holder.
//
// On success, Acquire returns a context that is cancelled when the lease's
// TTL elapses or when ctx is cancelled, along with a *Lease handle that must
// be passed to Release.
//
// On failure, Acquire returns an error. ErrLeaseAlreadyHeld indicates that
// an unexpired lease for name is currently owned by some holder (including
// possibly the caller).
func (m *Manager) Acquire(ctx context.Context, name string, opts ...AcquireOption) (context.Context, *Lease, error) {
	cfg := acquireOptions{ttl: defaultTTL}
	for _, opt := range opts {
		opt(&cfg)
	}
	_ = cfg
	return nil, nil, errors.New("not implemented")
}

// Release releases lease. It is not idempotent: releasing a lease that has
// already been released — or one that has expired — returns ErrLeaseLost.
func (m *Manager) Release(ctx context.Context, lease *Lease) error {
	return errors.New("not implemented")
}

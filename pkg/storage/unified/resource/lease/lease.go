package lease

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// defaultTTL is the TTL applied when an Acquire call does not pass WithTTL.
const defaultTTL = 10 * time.Second
const maxAcquireAttempts = 3

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
	lostCh     chan struct{}
	lostOnce   sync.Once
	lostTimer  *time.Timer
}

type leaseMetadata struct {
	Holder  string `json:"holder"`
	Expires int64  `json:"expires"`
	Deleted bool   `json:"deleted"`
}

// Lost returns a channel that is closed when this lease ends, i.e., when its TTL
// elapses or when Release succeeds. Calling Lost multiple times returns the
// same channel; the channel is closed at most once. Safe to call from any
// goroutine.
func (l *Lease) Lost() <-chan struct{} {
	return l.lostCh
}

func (l *Lease) markLost() {
	l.lostOnce.Do(func() {
		close(l.lostCh)
	})
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

// Acquire grabs the lease for `name` on behalf of the manager's holder. On
// success it returns a *Lease handle that must be passed to Release.
//
// On failure, Acquire returns an error. ErrLeaseAlreadyHeld indicates that
// an unexpired lease for name is currently owned by some holder (including
// possibly the caller).
func (m *Manager) Acquire(ctx context.Context, name string, opts ...AcquireOption) (*Lease, error) {
	if err := validateLeaseName(name); err != nil {
		return nil, err
	}

	cfg := acquireOptions{ttl: defaultTTL}
	for _, opt := range opts {
		opt(&cfg)
	}

	for attempt := 0; ; attempt++ {
		latestKey, latestGeneration, err := m.latest(ctx, name)
		if err != nil {
			return nil, err
		}

		now := time.Now()
		if latestKey != "" {
			latest, err := m.read(ctx, latestKey)
			if err != nil {
				return nil, err
			}
			if !latest.Deleted && now.Before(time.Unix(0, latest.Expires)) {
				return nil, ErrLeaseAlreadyHeld
			}
		}

		generation := latestGeneration + 1
		expires := now.Add(cfg.ttl)
		state := leaseMetadata{
			Holder:  m.holder,
			Expires: expires.UnixNano(),
		}
		value, err := json.Marshal(state)
		if err != nil {
			return nil, err
		}

		key := leaseKey(name, generation)
		err = m.store.Batch(ctx, kv.LeasesSection, []kv.BatchOp{{
			Mode:  kv.BatchOpCreate,
			Key:   key,
			Value: value,
		}})
		if errors.Is(err, kv.ErrKeyAlreadyExists) {
			if attempt >= maxAcquireAttempts-1 {
				return nil, fmt.Errorf("%w: exhausted retries acquiring %q", ErrLeaseAlreadyHeld, name)
			}
			continue
		}
		if err != nil {
			return nil, err
		}

		l := &Lease{
			name:       name,
			holder:     m.holder,
			generation: generation,
			lostCh:     make(chan struct{}),
		}
		l.lostTimer = time.AfterFunc(cfg.ttl, l.markLost)
		return l, nil
	}
}

// Release releases lease. It is not idempotent: releasing a lease that has
// already been released — or one that has expired — returns ErrLeaseLost.
func (m *Manager) Release(ctx context.Context, lease *Lease) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	key := leaseKey(lease.name, lease.generation)
	state, err := m.read(ctx, key)
	if errors.Is(err, kv.ErrNotFound) {
		return ErrLeaseLost
	}
	if err != nil {
		return err
	}

	if state.Holder != m.holder || state.Deleted || !time.Now().Before(time.Unix(0, state.Expires)) {
		return ErrLeaseLost
	}

	state.Deleted = true
	if err := m.save(ctx, key, state); err != nil {
		return err
	}

	lease.lostTimer.Stop()
	lease.markLost()
	return nil
}

func (m *Manager) latest(ctx context.Context, name string) (string, int64, error) {
	prefix := name + "/"
	opts := kv.ListOptions{
		Sort:     kv.SortOrderDesc,
		StartKey: prefix,
		EndKey:   kv.PrefixRangeEnd(prefix),
		Limit:    1,
	}

	for key, err := range m.store.Keys(ctx, kv.LeasesSection, opts) {
		if err != nil {
			return "", 0, err
		}
		generation, err := parseGeneration(name, key)
		if err != nil {
			return "", 0, err
		}
		return key, generation, nil
	}

	return "", 0, nil
}

func (m *Manager) read(ctx context.Context, key string) (leaseMetadata, error) {
	r, err := m.store.Get(ctx, kv.LeasesSection, key)
	if err != nil {
		return leaseMetadata{}, fmt.Errorf("fetching lease key: %w", err)
	}
	defer func() { _ = r.Close() }()

	data, err := io.ReadAll(r)
	if err != nil {
		return leaseMetadata{}, fmt.Errorf("reading lease key: %w", err)
	}

	var state leaseMetadata
	if err := json.Unmarshal(data, &state); err != nil {
		return leaseMetadata{}, fmt.Errorf("unmarshaling lease metadata: %w", err)
	}
	return state, nil
}

func (m *Manager) save(ctx context.Context, key string, state leaseMetadata) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}

	w, err := m.store.Save(ctx, kv.LeasesSection, key)
	if err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

// leaseKey generates a 20-digit generation suffix so leases sort
// lexicographically in generation order.
func leaseKey(name string, generation int64) string {
	return fmt.Sprintf("%s/%020d", name, generation)
}

func validateLeaseName(name string) error {
	if !kv.IsValidKey(name) {
		return fmt.Errorf("invalid lease name %q", name)
	}
	if strings.HasSuffix(name, "/") {
		return fmt.Errorf("invalid lease name %q: trailing slash is not allowed", name)
	}
	return nil
}

func parseGeneration(name, key string) (int64, error) {
	suffix, ok := strings.CutPrefix(key, name+"/")
	if !ok {
		return 0, fmt.Errorf("lease key %q does not match lease name %q", key, name)
	}
	generation, err := strconv.ParseInt(suffix, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse lease generation from %q: %w", key, err)
	}
	return generation, nil
}

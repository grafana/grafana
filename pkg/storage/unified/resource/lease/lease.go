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
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// TTL applied when an Acquire call does not pass WithTTL.
	defaultTTL = 10 * time.Second

	// minimum TTL accepted. Returns an error if the caller passes a lower duration.
	defaultMinTTL = 10 * time.Second

	// max TTL accepted
	maxTTL = 10 * time.Minute

	// maximum tolerated clock skew across hosts when deciding whether an
	// existing lease is still held by another process.
	defaultMaxClockSkew = 500 * time.Millisecond

	// maximum number of times an Acquire() call will loop to ensure a lease
	// is already acquired when it cannot create a unique key.
	maxAcquireAttempts = 3

	// generationSeparator joins a lease's name and its generation in the
	// persisted KV key (e.g. "my/lease~00000000000000000001"). This separator
	// is not allowed in lease names and ensures that we are able to do
	// range queries for the particular lease being requested without risk
	// of conflicting with other leases names that share the same prefix.
	generationSeparator = "~"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource/lease")

var (
	// ErrLeaseAlreadyHeld is returned by Acquire when an unexpired lease for
	// the requested name is already owned (by any holder, including the
	// caller).
	ErrLeaseAlreadyHeld = errors.New("lease already held")

	// ErrLeaseLost is returned by Release when the lease being released is no
	// longer owned by the caller — typically because it has expired, has
	// already been released, or was superseded by another holder. When
	// auto-renewal is enabled, this error also triggers the Lost() channel.
	ErrLeaseLost = errors.New("lease lost")
)

type Lease struct {
	key      atomic.Pointer[leaseKey]
	holder   string
	lostCh   chan struct{}
	lostOnce sync.Once
	stop     chan struct{}
	stopOnce sync.Once
	done     chan struct{}
}

// Lost returns a channel that is closed when this lease ends: when its TTL
// elapses without auto-renewal, when Release succeeds, or when an
// auto-renewal fails because another holder has acquired the lease.
// Calling Lost multiple times returns the same channel; the channel is
// closed at most once. Safe to call from any goroutine.
func (l *Lease) Lost() <-chan struct{} {
	return l.lostCh
}

func (l *Lease) notifyLoss() {
	l.lostOnce.Do(func() {
		close(l.lostCh)
	})
}

// leaseMetadata is the data saved in the KV store for each lease.
type leaseMetadata struct {
	Holder     string `json:"holder"`
	Expires    int64  `json:"expires"`
	Deleted    bool   `json:"deleted,omitempty"` // TODO: remove this field once every pod is running with `ReleasedAt` support
	ReleasedAt int64  `json:"released_at,omitempty"`
}

func (meta *leaseMetadata) ValidAsOf(ts time.Time) bool {
	return !meta.Deleted && meta.ReleasedAt == 0 && ts.Before(time.Unix(0, meta.Expires))
}

type leaseKey struct {
	name       string
	generation int64
}

func newLeaseKey(name string, generation int64) leaseKey {
	return leaseKey{name: name, generation: generation}
}

// String generates a 20-digit generation suffix so leases sort lexicographically
// in generation order.
func (k leaseKey) String() string {
	return fmt.Sprintf("%s%s%020d", k.name, generationSeparator, k.generation)
}

func parseLeaseKey(key string) (leaseKey, error) {
	idx := strings.Index(key, generationSeparator)
	if idx < 0 {
		return leaseKey{}, fmt.Errorf("invalid lease key %q: missing %q", key, generationSeparator)
	}
	name := key[:idx]
	gen, err := strconv.ParseInt(key[idx+len(generationSeparator):], 10, 64)
	if err != nil {
		return leaseKey{}, fmt.Errorf("parsing lease key %q: %w", key, err)
	}
	return newLeaseKey(name, gen), nil
}

// Manager acquires and releases leases backed by a KV store.
type Manager struct {
	store            kv.KV
	holder           string
	minTTL           time.Duration
	maxClockSkew     time.Duration
	log              logging.Logger
	garbageCollector *garbageCollector
	now              func() time.Time
	metrics          *Metrics
}

// NewManager returns a Manager that uses store for persistence and identifies
// itself as holder.
func NewManager(store kv.KV, holder string, reg prometheus.Registerer, opts ...ManagerOption) *Manager {
	m := &Manager{
		store:        store,
		holder:       holder,
		minTTL:       defaultMinTTL,
		maxClockSkew: defaultMaxClockSkew,
		log:          logging.DefaultLogger.With("logger", "lease-manager"),
		now:          time.Now,
		metrics:      NewMetrics(reg),
	}
	m.garbageCollector = newGarbageCollector(store, m.log, m.now, m.metrics)
	for _, opt := range opts {
		opt(m)
	}

	if m.garbageCollector != nil {
		m.garbageCollector.Start()
	}
	return m
}

// Metrics returns the Manager's metrics handle. Exposed primarily for tests
// that want to inspect specific collectors after exercising the Manager.
func (m *Manager) Metrics() *Metrics {
	return m.metrics
}

// ManagerOption configures a lease Manager.
type ManagerOption func(*Manager)

// WithInternalMinTTL overrides the minimum TTL accepted by a Manager and
// disables clock-skew compensation. This is intended only for tests that need
// short lease durations.
func WithInternalMinTTL(d time.Duration) ManagerOption {
	return func(m *Manager) {
		m.minTTL = d
		m.maxClockSkew = 0
	}
}

// WithInternalNowFunc overrides the clock used by a Manager. This is intended
// only for tests that to control lease timestamps.
func WithInternalNowFunc(now func() time.Time) ManagerOption {
	return func(m *Manager) {
		if now == nil {
			now = time.Now
		}
		m.now = now
		if m.garbageCollector != nil {
			m.garbageCollector.now = now
		}
	}
}

// WithGarbageCollectionDisabled allows the caller to opt-out of the automated
// garbage collection of leases that were released or expired longer than a
// grace period.
func WithGarbageCollectionDisabled(m *Manager) {
	m.garbageCollector = nil
}

// AcquireOption configures a single Acquire call.
type AcquireOption func(*acquireOptions)

type acquireOptions struct {
	ttl       time.Duration
	autoRenew bool
}

// WithTTL overrides the default lease TTL for this acquisition.
func WithTTL(d time.Duration) AcquireOption {
	return func(o *acquireOptions) { o.ttl = d }
}

// WithAutoRenew enables automatic lease renewal. A background goroutine
// extends the lease every ttl/3 by creating the next generation.
// Lost() is notified only when a renewal fails with ErrLeaseLost.
func WithAutoRenew() AcquireOption {
	return func(o *acquireOptions) {
		o.autoRenew = true
	}
}

// Acquire grabs the lease for `name` on behalf of the manager's holder. On
// success it returns a *Lease handle that must be passed to Release.
//
// On failure, Acquire returns an error. ErrLeaseAlreadyHeld indicates that
// an unexpired lease for name is currently owned by some holder (including
// possibly the caller).
func (m *Manager) Acquire(ctx context.Context, name string, opts ...AcquireOption) (lease *Lease, retErr error) {
	start := time.Now()
	ctx, span := tracer.Start(ctx, "lease.Manager.Acquire", trace.WithAttributes(
		attribute.String("lease.name", name),
		attribute.String("lease.holder", m.holder),
	))
	var attempts int
	defer func() {
		recordSpanError(span, retErr)
		span.SetAttributes(attribute.Int("attempts", attempts))
		span.End()
		m.metrics.observeAcquireRetries(attempts)
		m.metrics.observeAcquireDuration(time.Since(start), acquireOutcome(retErr))
	}()

	if err := validateLeaseName(name); err != nil {
		return nil, err
	}

	cfg := acquireOptions{ttl: defaultTTL}
	for _, opt := range opts {
		opt(&cfg)
	}

	if cfg.ttl < m.minTTL {
		return nil, fmt.Errorf("invalid TTL: %s < %s", cfg.ttl, m.minTTL)
	}

	if cfg.ttl > maxTTL {
		return nil, fmt.Errorf("invalid TTL: %s > %s", cfg.ttl, maxTTL)
	}

	for ; ; attempts++ {
		if attempts >= maxAcquireAttempts {
			return nil, fmt.Errorf("%w: exhausted retries acquiring %s", ErrLeaseAlreadyHeld, name)
		}

		latestKey, err := m.latest(ctx, name)
		if err != nil {
			return nil, fmt.Errorf("acquiring %s: %w", name, err)
		}

		now := m.now()
		var latestRaw []byte
		if latestKey.name != "" {
			latest, err := m.read(ctx, latestKey)
			if err != nil {
				if errors.Is(err, kv.ErrNotFound) {
					// While unlikely, it's possible that the key has since
					// been deleted by the garbage collection process if it
					// was close to the grace period by the time it was read.
					// Retry.
					continue
				}
				return nil, err
			}
			// Bias acquisition toward treating a remote lease as still held
			// to tolerate clock skew between hosts.
			if latest.ValidAsOf(now.Add(-m.maxClockSkew)) {
				return nil, ErrLeaseAlreadyHeld
			}
			latestRaw, err = json.Marshal(latest)
			if err != nil {
				return nil, fmt.Errorf("acquiring %s: %w", name, err)
			}
		}

		generation := latestKey.generation + 1
		expires := now.Add(cfg.ttl)
		state := leaseMetadata{
			Holder:  m.holder,
			Expires: expires.UnixNano(),
		}
		value, err := json.Marshal(state)
		if err != nil {
			return nil, err
		}

		key := newLeaseKey(name, generation)
		ops := []kv.BatchOp{{
			Mode:  kv.BatchOpCreate,
			Key:   key.String(),
			Value: value,
		}}
		if latestKey.name != "" {
			// Fail the Batch atomically if the previous generation we observed
			// has been deleted by GC. Without this, acquisition could race
			// with a background GC process and another caller could then
			// re-acquire this lease at generation=1.
			ops = append(ops, kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   latestKey.String(),
				Value: latestRaw,
			})
		}
		err = m.store.Batch(ctx, kv.LeasesSection, ops)
		if errors.Is(err, kv.ErrKeyAlreadyExists) || errors.Is(err, kv.ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("acquiring %s: %w", name, err)
		}

		l := &Lease{
			holder: m.holder,
			lostCh: make(chan struct{}),
			stop:   make(chan struct{}),
			done:   make(chan struct{}),
		}
		l.key.Store(&key)

		if cfg.autoRenew {
			renewInterval := cfg.ttl / 3
			go m.autoRenewLoop(l, expires, cfg.ttl, renewInterval)
		} else {
			go m.expiryLoop(l, expires.Sub(now))
		}
		return l, nil
	}
}

// Release releases lease. It is not idempotent: releasing a lease that has
// already been released — or one that has expired — returns ErrLeaseLost.
func (m *Manager) Release(ctx context.Context, lease *Lease) (retErr error) {
	start := time.Now()
	key := lease.key.Load()
	ctx, span := tracer.Start(ctx, "lease.Manager.Release", trace.WithAttributes(
		attribute.String("lease.name", key.name),
		attribute.String("lease.holder", lease.holder),
	))
	defer func() {
		recordSpanError(span, retErr)
		span.End()
		m.metrics.observeReleaseDuration(time.Since(start), releaseOutcome(retErr))
	}()

	lease.stopOnce.Do(func() { close(lease.stop) })
	<-lease.done
	defer lease.notifyLoss()

	// Reload after the auto-renew goroutine has exited so we release the
	// latest generation rather than one that the renewer may have just
	// tombstoned.
	key = lease.key.Load()
	meta, err := m.read(ctx, *key)
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return fmt.Errorf("releasing %s~%d: %w (not found)", key.name, key.generation, ErrLeaseLost)
		}
		return fmt.Errorf("releasing %s~%d: %w", key.name, key.generation, err)
	}

	// Note that we're not guaranteed to return ErrLeaseLost if two managers for
	// the same holder attempt to release the same lease concurrently due to
	// the lack of a conditional update primitive in the KV interface.
	//
	// Given that this use-case is quite contrived, this is an acceptable tradeoff
	// at this time.
	now := m.now()
	if meta.Holder != m.holder || !meta.ValidAsOf(now) {
		return fmt.Errorf("releasing %s~%d: %w", key.name, key.generation, ErrLeaseLost)
	}

	meta.Deleted = true
	meta.ReleasedAt = now.UnixNano()
	if err := m.save(ctx, *key, meta); err != nil {
		return fmt.Errorf("releasing %s~%d: %w", key.name, key.generation, err)
	}

	return nil
}

// Stop stops the garbage collection goroutine. Blocks until garbage collection
// stops running.
func (m *Manager) Stop() {
	if m.garbageCollector != nil {
		m.garbageCollector.Stop()
	}
}

// RunGarbageCollection runs one garbage collection attempt synchronously.
// Used for testing.
func (m *Manager) RunGarbageCollection(ctx context.Context) (int, error) {
	return newGarbageCollector(m.store, m.log, m.now, m.metrics).runOnce(ctx)
}

func (m *Manager) extendGeneration(ctx context.Context, lease *Lease, ttl time.Duration) (time.Time, error) {
	key := lease.key.Load()
	meta, err := m.read(ctx, *key)
	if err != nil {
		return time.Time{}, fmt.Errorf("extending %s~%d: %w", key.name, key.generation, err)
	}

	now := m.now()
	if meta.Holder != m.holder || !meta.ValidAsOf(now) {
		return time.Time{}, fmt.Errorf("extending %s~%d: %w", key.name, key.generation, ErrLeaseLost)
	}

	newGeneration := key.generation + 1
	expires := now.Add(ttl)
	state := leaseMetadata{
		Holder:  m.holder,
		Expires: expires.UnixNano(),
	}
	value, err := json.Marshal(state)
	if err != nil {
		return time.Time{}, err
	}

	meta.Deleted = true
	meta.ReleasedAt = now.UnixNano()
	tombstone, err := json.Marshal(meta)
	if err != nil {
		return time.Time{}, err
	}

	newKey := newLeaseKey(key.name, newGeneration)
	err = m.store.Batch(ctx, kv.LeasesSection, []kv.BatchOp{
		{Mode: kv.BatchOpCreate, Key: newKey.String(), Value: value},
		{Mode: kv.BatchOpUpdate, Key: key.String(), Value: tombstone},
	})
	if errors.Is(err, kv.ErrKeyAlreadyExists) {
		return time.Time{}, fmt.Errorf("extending %s~%d: %w", key.name, key.generation, ErrLeaseLost)
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("extending %s~%d: %w", key.name, key.generation, err)
	}

	lease.key.Store(&newKey)
	return expires, nil
}

func (m *Manager) expiryLoop(lease *Lease, remaining time.Duration) {
	defer close(lease.done)
	timer := time.NewTimer(remaining)
	defer timer.Stop()
	select {
	case <-lease.stop:
		return
	case <-timer.C:
		m.metrics.recordLoss(lossReasonExpired)
		lease.notifyLoss()
	}
}

func (m *Manager) autoRenewLoop(lease *Lease, expiry time.Time, ttl, renewInterval time.Duration) {
	defer close(lease.done)
	ticker := time.NewTicker(renewInterval)
	defer ticker.Stop()

	for {
		key := lease.key.Load()
		log := m.log.With("lease", key.name, "holder", lease.holder, "generation", key.generation)

		select {
		case <-lease.stop:
			return
		case <-ticker.C:
			newExpiry, err := m.renewOnce(lease, ttl, renewInterval)
			if errors.Is(err, ErrLeaseLost) {
				log.Warn("lease lost to another holder during renewal", "err", err)
				m.metrics.recordLoss(lossReasonLost)
				lease.notifyLoss()
				return
			}
			if err != nil {
				if m.now().After(expiry) {
					log.Error("lease lost: renewal retries exhausted before expiry", "err", err)
					m.metrics.recordLoss(lossReasonError)
					lease.notifyLoss()
					return
				}
				log.Warn("lease renewal failed, will retry", "time_until_expiry", expiry.Sub(m.now()), "err", err)
				continue
			}
			m.metrics.recordRenewal()
			expiry = newExpiry
		}
	}
}

func (m *Manager) renewOnce(lease *Lease, ttl, renewInterval time.Duration) (time.Time, error) {
	ctx, cancel := context.WithTimeout(context.Background(), renewInterval*3/4)
	defer cancel()
	return m.extendGeneration(ctx, lease, ttl)
}

func (m *Manager) latest(ctx context.Context, name string) (key leaseKey, retError error) {
	ctx, span := tracer.Start(ctx, "lease.Manager.latest", trace.WithAttributes(
		attribute.String("lease.name", name),
	))
	defer func() {
		recordSpanError(span, retError)
		span.End()
	}()

	prefix := name + generationSeparator
	opts := kv.ListOptions{
		Sort:     kv.SortOrderDesc,
		StartKey: prefix,
		EndKey:   kv.PrefixRangeEnd(prefix),
		Limit:    1,
	}

	for k, err := range m.store.Keys(ctx, kv.LeasesSection, opts) {
		if err != nil {
			return leaseKey{}, err
		}
		return parseLeaseKey(k)
	}

	return leaseKey{}, nil
}

func (m *Manager) read(ctx context.Context, key leaseKey) (state leaseMetadata, retError error) {
	ctx, span := tracer.Start(ctx, "lease.Manager.read", trace.WithAttributes(
		attribute.String("lease.key", key.String()),
	))
	defer func() {
		recordSpanError(span, retError)
		span.End()
	}()

	r, err := m.store.Get(ctx, kv.LeasesSection, key.String())
	if err != nil {
		return leaseMetadata{}, fmt.Errorf("fetching lease key: %w", err)
	}
	defer func() { _ = r.Close() }()

	data, err := io.ReadAll(r)
	if err != nil {
		return leaseMetadata{}, fmt.Errorf("reading lease key: %w", err)
	}

	if err := json.Unmarshal(data, &state); err != nil {
		return leaseMetadata{}, fmt.Errorf("unmarshaling lease metadata: %w", err)
	}
	return state, nil
}

func (m *Manager) save(ctx context.Context, key leaseKey, state leaseMetadata) (retError error) {
	ctx, span := tracer.Start(ctx, "lease.Manager.save", trace.WithAttributes(
		attribute.String("lease.key", key.String()),
	))
	defer func() {
		recordSpanError(span, retError)
		span.End()
	}()

	data, err := json.Marshal(state)
	if err != nil {
		return err
	}

	w, err := m.store.Save(ctx, kv.LeasesSection, key.String())
	if err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		if closeErr := w.Close(); closeErr != nil {
			return fmt.Errorf("%w (close error: %w)", err, closeErr)
		}
		return err
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("closing writer: %w", err)
	}

	return nil
}

func recordSpanError(span trace.Span, err error) {
	if err == nil {
		return
	}
	span.RecordError(err)
	span.SetStatus(otelcodes.Error, err.Error())
}

func validateLeaseName(name string) error {
	if !kv.IsValidKey(name) {
		return fmt.Errorf("invalid lease name %q", name)
	}
	if strings.Contains(name, generationSeparator) {
		return fmt.Errorf("invalid lease name %q: %q not allowed", name, generationSeparator)
	}
	if strings.HasPrefix(name, internalPrefix) {
		return fmt.Errorf("cannot use reserved lease name %q", name)
	}
	return nil
}

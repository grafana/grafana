package leaderelection

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// KVLeaseElector implements Elector using the KV store lease primitive.
// It is used for leader election in embedded mode where Kubernetes Lease
// objects are not available.
type KVLeaseElector struct {
	kvProvider    *kv.EventualKVProvider
	leaseName     string
	identity      string
	leaseDuration time.Duration
	renewDeadline time.Duration
	retryPeriod   time.Duration
	logger        log.Logger
	managerOpts   []lease.ManagerOption
}

// KVLeaseElectorOption configures a KVLeaseElector.
type KVLeaseElectorOption func(*KVLeaseElector)

// WithManagerOptions passes options to the underlying lease.Manager.
// Intended for tests that need short TTLs via lease.WithInternalMinTTL.
func WithManagerOptions(opts ...lease.ManagerOption) KVLeaseElectorOption {
	return func(e *KVLeaseElector) {
		e.managerOpts = opts
	}
}

// NewKVLeaseElector creates a KVLeaseElector. If cfg.Identity is empty, it is
// auto-generated from hostname:PID.
func NewKVLeaseElector(
	kvProvider *kv.EventualKVProvider,
	cfg Config,
	logger log.Logger,
	opts ...KVLeaseElectorOption,
) (*KVLeaseElector, error) {
	if cfg.LeaseName == "" {
		return nil, fmt.Errorf("leader_election_lease_name must be set")
	}

	identity := cfg.Identity
	if identity == "" {
		hostname, err := os.Hostname()
		if err != nil {
			hostname = "unknown"
		}
		identity = fmt.Sprintf("%s:%d", hostname, os.Getpid())
	}

	e := &KVLeaseElector{
		kvProvider:    kvProvider,
		leaseName:     cfg.LeaseName,
		identity:      identity,
		leaseDuration: cfg.LeaseDuration,
		renewDeadline: cfg.RenewDeadline,
		retryPeriod:   cfg.RetryPeriod,
		logger:        logger,
	}
	for _, opt := range opts {
		opt(e)
	}
	return e, nil
}

func (k *KVLeaseElector) Run(ctx context.Context, fn func(ctx context.Context), opts ...RunOption) error {
	o := &runOptions{
		releaseOnCancel: true,
		onStartedLeading: func(ctx context.Context) {
			k.logger.Info("Acquired KV lease, starting leader work",
				"identity", k.identity,
				"lease", k.leaseName,
			)
		},
		onStoppedLeading: func() {
			k.logger.Info("Lost KV lease, stopping leader work",
				"identity", k.identity,
			)
		},
	}
	for _, opt := range opts {
		opt(o)
	}

	store, err := k.kvProvider.Get(ctx)
	if err != nil {
		return fmt.Errorf("waiting for KV store: %w", err)
	}

	mgr := lease.NewManager(store, k.identity, k.managerOpts...)

	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		l, err := k.tryAcquire(ctx, mgr)
		if err != nil {
			return err
		}
		if l != nil {
			k.runAsLeader(ctx, l, mgr, fn, o)
		}
	}
}

// tryAcquire attempts to acquire the lease. Returns the lease on success,
// nil if the lease is held by someone else (after sleeping retryPeriod),
// or an error if the context is cancelled.
func (k *KVLeaseElector) tryAcquire(ctx context.Context, mgr *lease.Manager) (*lease.Lease, error) {
	l, err := mgr.Acquire(ctx, k.leaseName, lease.WithTTL(k.leaseDuration))
	if err == nil {
		return l, nil
	}

	if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
		t := time.NewTimer(k.retryPeriod)
		defer t.Stop()
		select {
		case <-t.C:
			return nil, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return nil, fmt.Errorf("acquiring lease: %w", err)
}

// runAsLeader runs the leader work function and renewal loop. Returns when
// leadership is lost or the context is cancelled.
func (k *KVLeaseElector) runAsLeader(
	ctx context.Context,
	l *lease.Lease,
	mgr *lease.Manager,
	fn func(ctx context.Context),
	o *runOptions,
) {
	leaderCtx, leaderCancel := context.WithCancel(ctx)
	defer leaderCancel()

	o.onStartedLeading(leaderCtx)

	done := make(chan struct{})
	go func() {
		fn(leaderCtx)
		close(done)
	}()

	k.renewLoop(ctx, l, mgr)

	leaderCancel()
	o.onStoppedLeading()

	if o.releaseOnCancel && ctx.Err() != nil {
		releaseCtx, releaseCancel := context.WithTimeout(context.Background(), 5*time.Second)
		if releaseErr := mgr.Release(releaseCtx, l); releaseErr != nil {
			k.logger.Debug("Failed to release lease on shutdown", "error", releaseErr)
		}
		releaseCancel()
	}

	<-done
}

// renewLoop periodically extends the lease. Returns when renewal fails for
// longer than renewDeadline or the parent context is cancelled.
func (k *KVLeaseElector) renewLoop(ctx context.Context, l *lease.Lease, mgr *lease.Manager) {
	ticker := time.NewTicker(k.retryPeriod)
	defer ticker.Stop()

	var firstFailure time.Time

	for {
		select {
		case <-ticker.C:
			err := mgr.Extend(ctx, l, lease.WithTTL(k.leaseDuration))
			if err == nil {
				firstFailure = time.Time{}
				continue
			}

			if errors.Is(err, lease.ErrLeaseLost) {
				k.logger.Warn("Lease lost", "error", err)
				return
			}

			now := time.Now()
			if firstFailure.IsZero() {
				firstFailure = now
			}
			if now.Sub(firstFailure) >= k.renewDeadline {
				k.logger.Warn("Lease renewal exceeded deadline", "deadline", k.renewDeadline, "error", err)
				return
			}
			k.logger.Warn("Lease renewal failed, retrying", "error", err)

		case <-l.Lost():
			k.logger.Warn("Lease TTL expired")
			return

		case <-ctx.Done():
			return
		}
	}
}

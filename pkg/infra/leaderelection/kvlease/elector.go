// Package kvlease provides a leader-election Elector backed by the KV
// lease primitive. It lives outside the parent leaderelection package so
// that consumers of leaderelection.Config (notably pkg/setting) don't
// transitively pull the unified-storage lease/test dependency tree.
package kvlease

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/prometheus/client_golang/prometheus"
)

// Elector implements leaderelection.Elector using the KV store lease
// primitive. It is used for leader election in embedded mode where
// Kubernetes Lease objects are not available.
//
// Unlike leaderelection.KubernetesElector, this implementation does not
// use Config.RenewDeadline. Renewal is handled internally by the lease
// package's auto-renewal goroutine (at TTL/3), which reports loss only
// when the lease is actually superseded by another holder.
// Config.RetryPeriod controls how often a non-leader retries acquisition.
type Elector struct {
	kvStore       kv.KV
	leaseName     string
	identity      string
	leaseDuration time.Duration
	retryPeriod   time.Duration
	logger        log.Logger
	reg           prometheus.Registerer
	managerOpts   []lease.ManagerOption
}

// Option configures an Elector.
type Option func(*Elector)

// WithManagerOptions passes options to the underlying lease.Manager.
// Intended for tests that need short TTLs via lease.WithInternalMinTTL.
func WithManagerOptions(opts ...lease.ManagerOption) Option {
	return func(e *Elector) {
		e.managerOpts = opts
	}
}

// New creates an Elector. If cfg.Identity is empty, it is auto-generated
// from hostname:PID.
func New(
	kvStore kv.KV,
	cfg leaderelection.Config,
	logger log.Logger,
	reg prometheus.Registerer,
	opts ...Option,
) (*Elector, error) {
	if kvStore == nil {
		return nil, errors.New("KV store is required")
	}
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

	e := &Elector{
		kvStore:       kvStore,
		leaseName:     cfg.LeaseName,
		identity:      identity,
		leaseDuration: cfg.LeaseDuration,
		retryPeriod:   cfg.RetryPeriod,
		logger:        logger,
		reg:           reg,
	}
	for _, opt := range opts {
		opt(e)
	}
	return e, nil
}

func (k *Elector) Run(ctx context.Context, fn func(ctx context.Context), opts ...leaderelection.RunOption) error {
	o := leaderelection.ResolveRunOptions([]leaderelection.RunOption{
		leaderelection.WithReleaseOnCancel(true),
		leaderelection.WithOnStartedLeading(func(ctx context.Context) {
			k.logger.Info("Acquired KV lease, starting leader work",
				"identity", k.identity,
				"lease", k.leaseName,
			)
		}),
		leaderelection.WithOnStoppedLeading(func() {
			k.logger.Info("Lost KV lease, stopping leader work",
				"identity", k.identity,
			)
		}),
	}, opts)

	mgr := lease.NewManager(k.kvStore, k.identity, k.reg, k.managerOpts...)

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
// nil if the lease is held by someone else (after waiting retryPeriod
// before the next attempt), or an error if the context is cancelled.
func (k *Elector) tryAcquire(ctx context.Context, mgr *lease.Manager) (*lease.Lease, error) {
	l, err := mgr.Acquire(ctx, k.leaseName, lease.WithTTL(k.leaseDuration), lease.WithAutoRenew())
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

// runAsLeader runs the leader work function. Returns when
// leadership is lost or the context is cancelled.
func (k *Elector) runAsLeader(
	ctx context.Context,
	l *lease.Lease,
	mgr *lease.Manager,
	fn func(ctx context.Context),
	o *leaderelection.RunOptions,
) {
	leaderCtx, leaderCancel := context.WithCancel(ctx)
	defer leaderCancel()
	defer o.OnStoppedLeading()

	go o.OnStartedLeading(leaderCtx)

	done := make(chan struct{})
	go func() {
		defer close(done)
		fn(leaderCtx)
	}()

	select {
	case <-l.Lost():
		k.logger.Warn("Lease lost")
	case <-ctx.Done():
	}

	leaderCancel()
	<-done

	if o.ReleaseOnCancel && ctx.Err() != nil {
		releaseCtx, releaseCancel := context.WithTimeout(context.Background(), 5*time.Second)
		if releaseErr := mgr.Release(releaseCtx, l); releaseErr != nil {
			k.logger.Debug("Failed to release lease on shutdown", "error", releaseErr)
		}
		releaseCancel()
	}
}

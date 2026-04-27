// Package leaderelection provides a thin wrapper around
// k8s.io/client-go/tools/leaderelection for leader election via Kubernetes
// Lease objects.
//
// Important: the underlying library does NOT guarantee that only one client is
// acting as leader at any given time (i.e. it does not provide fencing).
// Brief dual-leader windows are possible during network partitions or clock
// skew. This package inherits that limitation.
//
// For callers where single-leader semantics are critical, additional
// distributed-lock or fencing mechanisms should be layered on top. We may
// improve this in the future.
//
// See https://pkg.go.dev/k8s.io/client-go/tools/leaderelection for details.
package leaderelection

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Config holds the common settings every leader-election consumer needs.
type Config struct {
	// Enabled activates Kubernetes lease-based leader election.
	Enabled bool
	// LeaseName is the name of the Kubernetes Lease object.
	LeaseName string
	// Namespace is the Kubernetes namespace for the Lease object.
	Namespace string
	// Identity is the unique identity of this replica in the Lease.
	Identity string
	// LeaseDuration is how long a lease is held before another candidate can
	// acquire it.
	LeaseDuration time.Duration
	// RenewDeadline is the duration the leader retries refreshing leadership
	// before giving up.
	RenewDeadline time.Duration
	// RetryPeriod is the interval between leader election retries.
	RetryPeriod time.Duration
}

// Elector abstracts the leader election mechanism.
type Elector interface {
	// Run blocks, calling fn when this instance acquires leadership.
	// fn receives a context cancelled when leadership is lost.
	// Run returns when ctx is cancelled.
	Run(ctx context.Context, fn func(ctx context.Context), opts ...RunOption) error
}

// DefaultElector always acts as the leader (single-instance / backward compat).
type DefaultElector struct{}

// NewDefaultElector returns a DefaultElector that always acts as leader.
func NewDefaultElector() *DefaultElector {
	return &DefaultElector{}
}

// Run calls fn immediately and blocks until ctx is cancelled.
// RunOption values are accepted for interface compatibility but ignored.
func (n *DefaultElector) Run(ctx context.Context, fn func(ctx context.Context), _ ...RunOption) error {
	fn(ctx)
	return ctx.Err()
}

// NoopElector is a true no-op: it never calls fn and simply blocks until ctx
// is cancelled. Useful when the caller wants to satisfy the Elector interface
// without actually running any leader work.
type NoopElector struct{}

// NewNoopElector returns a NoopElector.
func NewNoopElector() *NoopElector {
	return &NoopElector{}
}

// Run blocks until ctx is cancelled without ever invoking fn.
func (n *NoopElector) Run(ctx context.Context, _ func(ctx context.Context), _ ...RunOption) error {
	return nil
}

// KubernetesElector uses coordination.k8s.io/v1 Lease resources.
type KubernetesElector struct {
	leaseName     string
	namespace     string
	identity      string
	leaseDuration time.Duration
	renewDeadline time.Duration
	retryPeriod   time.Duration
	kubeClient    kubernetes.Interface
	logger        log.Logger
}

// NewKubernetesElector creates a KubernetesElector.
// cfg.LeaseName, cfg.Namespace, and cfg.Identity must be non-empty.
func NewKubernetesElector(
	restCfg *clientrest.Config,
	cfg Config,
	logger log.Logger,
) (*KubernetesElector, error) {
	if cfg.LeaseName == "" {
		return nil, fmt.Errorf("leader_election_lease_name must be set")
	}
	if cfg.Namespace == "" {
		return nil, fmt.Errorf("leader_election_namespace must be set")
	}
	if cfg.Identity == "" {
		return nil, fmt.Errorf("leader_election_identity must be set")
	}

	kubeClient, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	return &KubernetesElector{
		leaseName:     cfg.LeaseName,
		namespace:     cfg.Namespace,
		identity:      cfg.Identity,
		leaseDuration: cfg.LeaseDuration,
		renewDeadline: cfg.RenewDeadline,
		retryPeriod:   cfg.RetryPeriod,
		kubeClient:    kubeClient,
		logger:        logger,
	}, nil
}

// Run participates in leader election and calls fn when leadership is acquired.
// fn receives a context that is cancelled when leadership is lost.
// Run blocks until ctx is cancelled.
func (k *KubernetesElector) Run(ctx context.Context, fn func(ctx context.Context), opts ...RunOption) error {
	o := &runOptions{
		releaseOnCancel: true,
		onStartedLeading: func(ctx context.Context) {
			k.logger.Info("Acquired leader lease, starting leader work",
				"identity", k.identity,
				"lease", k.leaseName,
				"namespace", k.namespace,
			)
		},
		onStoppedLeading: func() {
			k.logger.Info("Lost leader lease, stopping leader work",
				"identity", k.identity,
			)
		},
		onNewLeader: func(identity string) {
			if identity != k.identity {
				k.logger.Info("New leader elected", "leader", identity)
			}
		},
	}

	for _, opt := range opts {
		opt(o)
	}

	lock := &resourcelock.LeaseLock{
		LeaseMeta: metav1.ObjectMeta{
			Name:      k.leaseName,
			Namespace: k.namespace,
		},
		Client: k.kubeClient.CoordinationV1(),
		LockConfig: resourcelock.ResourceLockConfig{
			Identity: k.identity,
		},
	}

	le, err := leaderelection.NewLeaderElector(leaderelection.LeaderElectionConfig{
		Lock:            lock,
		LeaseDuration:   k.leaseDuration,
		RenewDeadline:   k.renewDeadline,
		RetryPeriod:     k.retryPeriod,
		ReleaseOnCancel: o.releaseOnCancel,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: func(ctx context.Context) {
				o.onStartedLeading(ctx)
				fn(ctx)
			},
			OnStoppedLeading: o.onStoppedLeading,
			OnNewLeader:      o.onNewLeader,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create leader elector: %w", err)
	}

	le.Run(ctx)
	return ctx.Err()
}

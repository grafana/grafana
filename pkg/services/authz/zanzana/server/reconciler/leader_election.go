package reconciler

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

// LeaderElector abstracts the leader election mechanism.
type LeaderElector interface {
	// Run blocks, calling fn when this instance acquires leadership.
	// fn receives a context cancelled when leadership is lost.
	// Run returns when ctx is cancelled.
	Run(ctx context.Context, fn func(ctx context.Context)) error
}

// NoopLeaderElector always acts as the leader (single-instance / backward compat).
type NoopLeaderElector struct{}

// NewNoopLeaderElector returns a NoopLeaderElector that always acts as leader.
func NewNoopLeaderElector() *NoopLeaderElector {
	return &NoopLeaderElector{}
}

// Run calls fn immediately and blocks until ctx is cancelled.
func (n *NoopLeaderElector) Run(ctx context.Context, fn func(ctx context.Context)) error {
	fn(ctx)
	return ctx.Err()
}

// KubernetesLeaderElector uses coordination.k8s.io/v1 Lease resources.
type KubernetesLeaderElector struct {
	leaseName     string
	namespace     string
	identity      string
	leaseDuration time.Duration
	renewDeadline time.Duration
	retryPeriod   time.Duration
	kubeClient    kubernetes.Interface
	logger        log.Logger
}

// NewKubernetesLeaderElector creates a KubernetesLeaderElector from the provided REST config.
// All string parameters must be non-empty; they are expected to come from reconciler settings.
func NewKubernetesLeaderElector(
	restCfg *clientrest.Config,
	leaseName string,
	namespace string,
	identity string,
	leaseDuration time.Duration,
	renewDeadline time.Duration,
	retryPeriod time.Duration,
	logger log.Logger,
) (*KubernetesLeaderElector, error) {
	if leaseName == "" {
		return nil, fmt.Errorf("leader_election_lease_name must be set")
	}
	if namespace == "" {
		return nil, fmt.Errorf("leader_election_namespace must be set")
	}
	if identity == "" {
		return nil, fmt.Errorf("leader_election_identity must be set")
	}

	kubeClient, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	return &KubernetesLeaderElector{
		leaseName:     leaseName,
		namespace:     namespace,
		identity:      identity,
		leaseDuration: leaseDuration,
		renewDeadline: renewDeadline,
		retryPeriod:   retryPeriod,
		kubeClient:    kubeClient,
		logger:        logger,
	}, nil
}

// Run participates in leader election and calls fn when leadership is acquired.
// fn receives a context that is cancelled when leadership is lost.
// Run blocks until ctx is cancelled.
func (k *KubernetesLeaderElector) Run(ctx context.Context, fn func(ctx context.Context)) error {
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
		ReleaseOnCancel: true,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: func(ctx context.Context) {
				k.logger.Info("Acquired leader lease, starting reconciler loop",
					"identity", k.identity,
					"lease", k.leaseName,
					"namespace", k.namespace,
				)
				fn(ctx)
			},
			OnStoppedLeading: func() {
				k.logger.Info("Lost leader lease, stopping reconciler loop",
					"identity", k.identity,
				)
			},
			OnNewLeader: func(identity string) {
				if identity != k.identity {
					k.logger.Info("New leader elected", "leader", identity)
				}
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create leader elector: %w", err)
	}

	le.Run(ctx)
	return ctx.Err()
}

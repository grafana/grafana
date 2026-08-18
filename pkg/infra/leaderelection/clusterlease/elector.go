// Package clusterlease provides a leaderelection.Elector backed by a cluster-scoped
// coordination.grafana.app ClusterLease served by the Grafana apiserver. It lives
// outside the parent leaderelection package (mirroring the kvlease sub-package) so
// that consumers of leaderelection.Config — notably pkg/setting — don't transitively
// pull the coordination app / grafana-app-sdk dependency tree.
//
// Use it where a served, inspectable, cross-tenant leader lease is wanted instead of
// a coordination.k8s.io Lease (which requires a real Kubernetes cluster to be
// reachable). The election machinery is shared with the coordination app's own
// garbage collector via apps/coordination/pkg/leaderelection.
package clusterlease

import (
	"context"
	"fmt"
	"time"

	clientrest "k8s.io/client-go/rest"
	k8sle "k8s.io/client-go/tools/leaderelection"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
	coordle "github.com/grafana/grafana/apps/coordination/pkg/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	defaultLeaseDuration = 60 * time.Second
	defaultRenewDeadline = 40 * time.Second
	defaultRetryPeriod   = 15 * time.Second

	// The ClusterLease admission validator bounds leaseDurationSeconds to [10, 600].
	minLeaseDurationSeconds = 10
	maxLeaseDurationSeconds = 600
)

var _ leaderelection.Elector = (*Elector)(nil)

// Elector implements leaderelection.Elector over a coordination ClusterLease.
type Elector struct {
	client   resource.Client
	name     string
	identity string
	timings  coordle.Timings
	logger   log.Logger
}

// New builds an Elector that elects a leader on the ClusterLease named
// cfg.LeaseName. It creates a ClusterLease client from restCfg (which must point at
// the Grafana apiserver). cfg.Namespace is ignored — ClusterLease is cluster-scoped.
// Empty cfg.Identity defaults to "<hostname>_<pid>". Zero-valued timings fall back to
// 60s/40s/15s. LeaseDuration must resolve within the ClusterLease admission bounds.
func New(restCfg *clientrest.Config, cfg leaderelection.Config, logger log.Logger) (*Elector, error) {
	if cfg.LeaseName == "" {
		return nil, fmt.Errorf("leader election lease name must be set")
	}

	timings := coordle.Timings{
		LeaseDuration: orDefault(cfg.LeaseDuration, defaultLeaseDuration),
		RenewDeadline: orDefault(cfg.RenewDeadline, defaultRenewDeadline),
		RetryPeriod:   orDefault(cfg.RetryPeriod, defaultRetryPeriod),
	}
	if secs := timings.LeaseDuration.Seconds(); secs < minLeaseDurationSeconds || secs > maxLeaseDurationSeconds {
		return nil, fmt.Errorf("lease duration must resolve within [%ds, %ds], got %s",
			minLeaseDurationSeconds, maxLeaseDurationSeconds, timings.LeaseDuration)
	}

	kc := *restCfg
	kc.APIPath = "/apis"
	client, err := k8s.NewClientRegistry(kc, k8s.DefaultClientConfig()).ClientFor(coordinationv0alpha1.ClusterLeaseKind())
	if err != nil {
		return nil, fmt.Errorf("create cluster lease client: %w", err)
	}

	identity := cfg.Identity
	if identity == "" {
		identity = coordle.DefaultIdentity()
	}

	return &Elector{
		client:   client,
		name:     cfg.LeaseName,
		identity: identity,
		timings:  timings,
		logger:   logger,
	}, nil
}

// Run participates in leader election and calls fn when leadership is acquired. fn
// receives a context cancelled when leadership is lost; Run re-contends after loss
// and returns when ctx is cancelled.
func (e *Elector) Run(ctx context.Context, fn func(ctx context.Context), opts ...leaderelection.RunOption) error {
	o := leaderelection.ResolveRunOptions([]leaderelection.RunOption{
		leaderelection.WithReleaseOnCancel(true),
		leaderelection.WithOnStartedLeading(func(context.Context) {
			e.logger.Info("acquired coordination leader lease", "lease", e.name, "identity", e.identity)
		}),
		leaderelection.WithOnStoppedLeading(func() {
			e.logger.Info("lost coordination leader lease", "identity", e.identity)
		}),
		leaderelection.WithOnNewLeader(func(identity string) {
			if identity != e.identity {
				e.logger.Info("new coordination leader elected", "leader", identity)
			}
		}),
	}, opts)

	lock := coordle.NewLock(e.client, e.name, e.identity)
	coordle.Run(ctx, lock, e.name, e.timings, k8sle.LeaderCallbacks{
		OnStartedLeading: func(leaderCtx context.Context) {
			o.OnStartedLeading(leaderCtx)
			fn(leaderCtx)
		},
		OnStoppedLeading: o.OnStoppedLeading,
		OnNewLeader:      o.OnNewLeader,
	})
	return ctx.Err()
}

func orDefault(d, def time.Duration) time.Duration {
	if d <= 0 {
		return def
	}
	return d
}

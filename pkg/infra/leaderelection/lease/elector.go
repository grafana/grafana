// Package lease provides a leaderelection.Elector backed by a namespaced
// coordination.grafana.app Lease served by the Grafana apiserver — the tenant-scoped
// counterpart of the globallease elector. Use it to elect a leader for work whose
// domain is a single tenant (org/stack): the lease lives in that tenant's namespace.
//
// It lives outside the parent leaderelection package (mirroring the kvlease and
// globallease sub-packages) so consumers of leaderelection.Config don't
// transitively pull the coordination app / grafana-app-sdk dependency tree. The
// election machinery is shared with the GlobalLease elector via
// apps/coordination/pkg/leaderelection.
package lease

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

	// The Lease admission validator bounds leaseDurationSeconds to [10, 600].
	minLeaseDurationSeconds = 10
	maxLeaseDurationSeconds = 600
)

var _ leaderelection.Elector = (*Elector)(nil)

// Elector implements leaderelection.Elector over a namespaced coordination Lease.
type Elector struct {
	client    resource.Client
	namespace string
	name      string
	identity  string
	timings   coordle.Timings
	logger    log.Logger
}

// New builds an Elector that elects a leader on the Lease named cfg.LeaseName in
// cfg.Namespace. It creates a Lease client from restCfg (which must point at the
// Grafana apiserver). Empty cfg.Identity defaults to "<hostname>_<pid>". Zero-valued
// timings fall back to 60s/40s/15s. LeaseDuration must resolve within the Lease
// admission bounds.
func New(restCfg *clientrest.Config, cfg leaderelection.Config, logger log.Logger) (*Elector, error) {
	if cfg.LeaseName == "" {
		return nil, fmt.Errorf("leader election lease name must be set")
	}
	if cfg.Namespace == "" {
		return nil, fmt.Errorf("leader election namespace must be set")
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
	client, err := k8s.NewClientRegistry(kc, k8s.DefaultClientConfig()).ClientFor(coordinationv0alpha1.LeaseKind())
	if err != nil {
		return nil, fmt.Errorf("create lease client: %w", err)
	}

	identity := cfg.Identity
	if identity == "" {
		identity = coordle.DefaultIdentity()
	}

	return &Elector{
		client:    client,
		namespace: cfg.Namespace,
		name:      cfg.LeaseName,
		identity:  identity,
		timings:   timings,
		logger:    logger,
	}, nil
}

// Run participates in leader election and calls fn when leadership is acquired. fn
// receives a context cancelled when leadership is lost; Run re-contends after loss
// and returns when ctx is cancelled.
func (e *Elector) Run(ctx context.Context, fn func(ctx context.Context), opts ...leaderelection.RunOption) error {
	o := leaderelection.ResolveRunOptions([]leaderelection.RunOption{
		leaderelection.WithReleaseOnCancel(true),
		leaderelection.WithOnStartedLeading(func(context.Context) {
			e.logger.Info("acquired coordination lease", "namespace", e.namespace, "lease", e.name, "identity", e.identity)
		}),
		leaderelection.WithOnStoppedLeading(func() {
			e.logger.Info("lost coordination lease", "namespace", e.namespace, "lease", e.name, "identity", e.identity)
		}),
		leaderelection.WithOnNewLeader(func(identity string) {
			if identity != e.identity {
				e.logger.Info("new coordination lease holder", "namespace", e.namespace, "lease", e.name, "holder", identity)
			}
		}),
	}, opts)

	lock := coordle.NewNamespacedLock(e.client, e.namespace, e.name, e.identity)
	coordle.Run(ctx, lock, e.namespace+"/"+e.name, e.timings, k8sle.LeaderCallbacks{
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

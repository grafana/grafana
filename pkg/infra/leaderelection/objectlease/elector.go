// Package objectlease provides a leaderelection.Elector that stores the
// leader-election record in the annotations of an existing object — an "object
// lease" — instead of a dedicated coordination.grafana.app Lease/GlobalLease. The
// target object's own resourceVersion provides the compare-and-swap, so no separate
// lease resource is created.
//
// It lives outside the parent leaderelection package (mirroring the kvlease and
// globallease sub-packages) so that consumers of leaderelection.Config don't
// transitively pull the coordination app / grafana-app-sdk dependency tree. The
// election machinery is shared with the GlobalLease elector via
// apps/coordination/pkg/leaderelection.
//
// Use it to lease an existing object in place. Because each renewal writes the
// target's annotations (bumping its resourceVersion), it suits objects without a hot
// reconciler, or reconcilers that ignore annotation-only changes.
package objectlease

import (
	"context"
	"fmt"
	"time"

	clientrest "k8s.io/client-go/rest"
	k8sle "k8s.io/client-go/tools/leaderelection"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"

	coordle "github.com/grafana/grafana/apps/coordination/pkg/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	defaultLeaseDuration = 60 * time.Second
	defaultRenewDeadline = 40 * time.Second
	defaultRetryPeriod   = 15 * time.Second
)

var _ leaderelection.Elector = (*Elector)(nil)

// Elector implements leaderelection.Elector using an object lease: the record lives
// in the target object's annotations.
type Elector struct {
	client   resource.Client
	id       resource.Identifier
	identity string
	timings  coordle.Timings
	logger   log.Logger
}

// New builds an Elector that elects a leader on the annotations of the object
// identified by id, of the given kind. It builds a client for kind from restCfg
// (which must point at the Grafana apiserver). Empty cfg.Identity defaults to
// "<hostname>_<pid>". Zero-valued timings fall back to 60s/40s/15s. cfg.LeaseName is
// ignored — the lease target is the object id. Unlike a GlobalLease there is no
// admission bound on the duration; it is a plain annotation.
func New(restCfg *clientrest.Config, kind resource.Kind, id resource.Identifier, cfg leaderelection.Config, logger log.Logger) (*Elector, error) {
	kc := *restCfg
	kc.APIPath = "/apis"
	client, err := k8s.NewClientRegistry(kc, k8s.DefaultClientConfig()).ClientFor(kind)
	if err != nil {
		return nil, fmt.Errorf("create object lease client: %w", err)
	}
	return NewWithClient(client, id, cfg, logger)
}

// NewWithClient is like New but uses a caller-provided client for the target kind.
func NewWithClient(client resource.Client, id resource.Identifier, cfg leaderelection.Config, logger log.Logger) (*Elector, error) {
	if id.Name == "" {
		return nil, fmt.Errorf("object lease target name must be set")
	}
	identity := cfg.Identity
	if identity == "" {
		identity = coordle.DefaultIdentity()
	}
	return &Elector{
		client:   client,
		id:       id,
		identity: identity,
		timings: coordle.Timings{
			LeaseDuration: orDefault(cfg.LeaseDuration, defaultLeaseDuration),
			RenewDeadline: orDefault(cfg.RenewDeadline, defaultRenewDeadline),
			RetryPeriod:   orDefault(cfg.RetryPeriod, defaultRetryPeriod),
		},
		logger: logger,
	}, nil
}

// Run participates in leader election on the object's annotations and calls fn when
// leadership is acquired. fn receives a context cancelled when leadership is lost;
// Run re-contends after loss and returns when ctx is cancelled.
func (e *Elector) Run(ctx context.Context, fn func(ctx context.Context), opts ...leaderelection.RunOption) error {
	o := leaderelection.ResolveRunOptions([]leaderelection.RunOption{
		leaderelection.WithReleaseOnCancel(true),
		leaderelection.WithOnStartedLeading(func(context.Context) {
			e.logger.Info("acquired object lease", "object", e.describe(), "identity", e.identity)
		}),
		leaderelection.WithOnStoppedLeading(func() {
			e.logger.Info("lost object lease", "object", e.describe(), "identity", e.identity)
		}),
		leaderelection.WithOnNewLeader(func(identity string) {
			if identity != e.identity {
				e.logger.Info("new object-lease holder", "object", e.describe(), "holder", identity)
			}
		}),
	}, opts)

	lock := coordle.NewObjectLock(e.client, e.id, e.identity)
	coordle.Run(ctx, lock, e.describe(), e.timings, k8sle.LeaderCallbacks{
		OnStartedLeading: func(leaderCtx context.Context) {
			o.OnStartedLeading(leaderCtx)
			fn(leaderCtx)
		},
		OnStoppedLeading: o.OnStoppedLeading,
		OnNewLeader:      o.OnNewLeader,
	})
	return ctx.Err()
}

func (e *Elector) describe() string {
	if e.id.Namespace != "" {
		return e.id.Namespace + "/" + e.id.Name
	}
	return e.id.Name
}

func orDefault(d, def time.Duration) time.Duration {
	if d <= 0 {
		return def
	}
	return d
}

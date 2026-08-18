package app

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

// newGarbageCollector builds the lease garbage collector from the app config: a
// reconciler that watches both lease kinds, and a leader-election runnable that
// elects the single replica allowed to delete. It returns (nil, nil, nil) when
// garbage collection is disabled — in which case the app serves the kinds without
// running any GC. The reconciler and runnable share a leader flag: every replica
// watches and schedules cleanups, but only the elected one performs deletions.
func newGarbageCollector(cfg app.Config) (operator.Reconciler, app.Runnable, error) {
	ccfg, ok := cfg.SpecificConfig.(*CoordinationConfig)
	if !ok || ccfg == nil || !ccfg.EnableGarbageCollector {
		return nil, nil, nil
	}

	clients := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
	leaseClient, err := clients.ClientFor(coordinationv0alpha1.LeaseKind())
	if err != nil {
		return nil, nil, fmt.Errorf("coordination GC: unable to create Lease client: %w", err)
	}
	clusterLeaseClient, err := clients.ClientFor(coordinationv0alpha1.ClusterLeaseKind())
	if err != nil {
		return nil, nil, fmt.Errorf("coordination GC: unable to create ClusterLease client: %w", err)
	}

	grace := ccfg.GracePeriod
	if grace <= 0 {
		grace = defaultGCGracePeriod
	}

	// leader is toggled by the election runnable and read by the reconciler.
	leader := &atomic.Bool{}
	reconciler := &leaseGCReconciler{
		leaseClient:        leaseClient,
		clusterLeaseClient: clusterLeaseClient,
		gracePeriod:        grace,
		now:                time.Now,
		isLeader:           leader.Load,
	}
	identity := gcIdentity()
	runnable := &gcLeaderRunnable{
		lock:      &clusterLeaseLock{client: clusterLeaseClient, name: gcLeaseName, identity: identity},
		setLeader: leader.Store,
		identity:  identity,
	}
	return reconciler, runnable, nil
}

// leaseGCReconciler deletes leases whose expiry (renewTime + leaseDurationSeconds)
// lies more than gracePeriod in the past. It is informer-driven: on each lease event
// it computes when the lease becomes GC-eligible and requeues itself for that moment,
// so a lease is swept shortly after it goes stale rather than on a fixed poll. It
// serves both the namespaced Lease and the cluster-scoped ClusterLease.
//
// Deleting a lease is always safe: a returning holder's renewal hits 404 and re-enters
// acquisition, the same path as any lost lease — election correctness never depends on
// GC. The delete carries a resourceVersion precondition, so a lease renewed between
// observation and deletion is left alone (the renewal fires a fresh event that
// reschedules). GC is hygiene only; it introduces no server-side election semantics.
type leaseGCReconciler struct {
	leaseClient        resource.Client
	clusterLeaseClient resource.Client
	gracePeriod        time.Duration
	// now is injectable for tests; defaults to time.Now.
	now func() time.Time
	// isLeader reports whether this replica is the elected GC leader. Only the leader
	// deletes; non-leaders watch and schedule but defer the mutation. Nil means
	// unguarded (used in tests).
	isLeader func() bool
}

var _ operator.Reconciler = (*leaseGCReconciler)(nil)

func (r *leaseGCReconciler) Reconcile(ctx context.Context, req operator.ReconcileRequest) (operator.ReconcileResult, error) {
	if req.Action == operator.ReconcileActionDeleted {
		return operator.ReconcileResult{}, nil
	}

	renewTime, durationSeconds, client := r.leaseInfo(req.Object)
	if client == nil || renewTime == nil || durationSeconds == nil {
		// Not a lease we manage, or not enough information to expire it (e.g. a lease
		// that was created but never renewed). Leave it alone.
		return operator.ReconcileResult{}, nil
	}

	renewed, err := time.Parse(time.RFC3339, *renewTime)
	if err != nil {
		// Don't guess at a malformed timestamp; leave the lease for a human to inspect.
		logging.FromContext(ctx).Warn("coordination GC: unparseable renewTime, skipping",
			"name", req.Object.GetName(), "renewTime", *renewTime)
		return operator.ReconcileResult{}, nil
	}

	deadline := renewed.Add(time.Duration(*durationSeconds) * time.Second).Add(r.gracePeriod)
	if wait := deadline.Sub(r.now()); wait > 0 {
		// Not yet collectable — come back exactly when it becomes eligible.
		return operator.ReconcileResult{RequeueAfter: &wait}, nil
	}

	if r.isLeader != nil && !r.isLeader() {
		// This replica watches and schedules but isn't the elected GC leader; the
		// leader will collect this lease. A subsequent resync re-evaluates it here if
		// leadership moves to this replica.
		return operator.ReconcileResult{}, nil
	}

	id := req.Object.GetStaticMetadata().Identifier()
	err = client.Delete(ctx, id, resource.DeleteOptions{
		Preconditions: resource.DeleteOptionsPreconditions{
			ResourceVersion: req.Object.GetResourceVersion(),
		},
	})
	switch {
	case err == nil:
		logging.FromContext(ctx).Info("coordination GC: deleted expired lease",
			"namespace", id.Namespace, "name", id.Name)
		return operator.ReconcileResult{}, nil
	case apierrors.IsNotFound(err), apierrors.IsConflict(err):
		// Already gone, or renewed out from under us (a fresh event will reschedule).
		return operator.ReconcileResult{}, nil
	default:
		return operator.ReconcileResult{}, err
	}
}

// leaseInfo extracts the expiry-relevant fields and the client to delete with, for
// whichever lease kind the object is. It returns a nil client for anything else.
func (r *leaseGCReconciler) leaseInfo(obj resource.Object) (renewTime *string, durationSeconds *int32, client resource.Client) {
	switch o := obj.(type) {
	case *coordinationv0alpha1.Lease:
		return o.Spec.RenewTime, o.Spec.LeaseDurationSeconds, r.leaseClient
	case *coordinationv0alpha1.ClusterLease:
		return o.Spec.RenewTime, o.Spec.LeaseDurationSeconds, r.clusterLeaseClient
	}
	return nil, nil, nil
}

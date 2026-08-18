package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

const (
	// gcLeaseName is the ClusterLease the garbage collector elects its leader on. The
	// controller dogfoods the very primitive it maintains: its own leader lease is a
	// ClusterLease served by this app, and self-hosting is sound because GC only
	// deletes leases dead for hours while this lease is renewed every few seconds.
	gcLeaseName = "coordination-gc"

	// Election timings. LeaseDuration is within the admission bounds ([10, 600]s) so
	// the GC lease is accepted by the same validator that guards every other lease.
	gcLeaseDuration = 15 * time.Second
	gcRenewDeadline = 10 * time.Second
	gcRetryPeriod   = 2 * time.Second
)

// clusterLeaseLock adapts a coordination ClusterLease to client-go's
// resourcelock.Interface, so the GC leader election runs on the coordination API
// itself rather than a separate mechanism. The lock stores the resourceVersion of
// the last observed lease and uses it as an update precondition, giving the same
// compare-and-swap acquisition client-go expects from a native Lease.
type clusterLeaseLock struct {
	client   resource.Client
	name     string
	identity string
	lastRV   string
}

var _ resourcelock.Interface = (*clusterLeaseLock)(nil)

func (l *clusterLeaseLock) Get(ctx context.Context) (*resourcelock.LeaderElectionRecord, []byte, error) {
	obj, err := l.client.Get(ctx, resource.Identifier{Name: l.name})
	if err != nil {
		return nil, nil, err
	}
	cl, ok := obj.(*coordinationv0alpha1.ClusterLease)
	if !ok {
		return nil, nil, fmt.Errorf("unexpected object type %T for cluster lease %q", obj, l.name)
	}
	l.lastRV = cl.GetResourceVersion()
	record := clusterLeaseToRecord(cl.Spec)
	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, nil, err
	}
	return &record, recordBytes, nil
}

func (l *clusterLeaseLock) Create(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	cl := &coordinationv0alpha1.ClusterLease{}
	cl.SetName(l.name)
	recordToClusterLease(&cl.Spec, ler)
	created, err := l.client.Create(ctx, resource.Identifier{Name: l.name}, cl, resource.CreateOptions{})
	if err != nil {
		return err
	}
	l.lastRV = created.GetResourceVersion()
	return nil
}

func (l *clusterLeaseLock) Update(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	if l.lastRV == "" {
		return fmt.Errorf("cluster lease %q not fetched before update", l.name)
	}
	cl := &coordinationv0alpha1.ClusterLease{}
	cl.SetName(l.name)
	recordToClusterLease(&cl.Spec, ler)
	updated, err := l.client.Update(ctx, resource.Identifier{Name: l.name}, cl, resource.UpdateOptions{
		ResourceVersion: l.lastRV,
	})
	if err != nil {
		return err
	}
	l.lastRV = updated.GetResourceVersion()
	return nil
}

func (l *clusterLeaseLock) RecordEvent(string) {}
func (l *clusterLeaseLock) Identity() string   { return l.identity }
func (l *clusterLeaseLock) Describe() string {
	return "clusterleases.coordination.grafana.app/" + l.name
}

// clusterLeaseToRecord maps a ClusterLease spec onto client-go's election record.
func clusterLeaseToRecord(spec coordinationv0alpha1.ClusterLeaseSpec) resourcelock.LeaderElectionRecord {
	r := resourcelock.LeaderElectionRecord{}
	if spec.HolderIdentity != nil {
		r.HolderIdentity = *spec.HolderIdentity
	}
	if spec.LeaseDurationSeconds != nil {
		r.LeaseDurationSeconds = int(*spec.LeaseDurationSeconds)
	}
	if spec.LeaseTransitions != nil {
		r.LeaderTransitions = int(*spec.LeaseTransitions)
	}
	if spec.AcquireTime != nil {
		if t, err := time.Parse(time.RFC3339, *spec.AcquireTime); err == nil {
			r.AcquireTime = metav1.NewTime(t)
		}
	}
	if spec.RenewTime != nil {
		if t, err := time.Parse(time.RFC3339, *spec.RenewTime); err == nil {
			r.RenewTime = metav1.NewTime(t)
		}
	}
	return r
}

// recordToClusterLease maps client-go's election record onto a ClusterLease spec.
// Timestamps become RFC3339 strings, matching the kind's schema.
func recordToClusterLease(spec *coordinationv0alpha1.ClusterLeaseSpec, r resourcelock.LeaderElectionRecord) {
	holder := r.HolderIdentity
	spec.HolderIdentity = &holder
	dur := int32(r.LeaseDurationSeconds)
	spec.LeaseDurationSeconds = &dur
	trans := int32(r.LeaderTransitions)
	spec.LeaseTransitions = &trans
	if !r.AcquireTime.IsZero() {
		s := r.AcquireTime.UTC().Format(time.RFC3339)
		spec.AcquireTime = &s
	}
	if !r.RenewTime.IsZero() {
		s := r.RenewTime.UTC().Format(time.RFC3339)
		spec.RenewTime = &s
	}
}

// gcLeaderRunnable runs leader election on the GC ClusterLease and toggles the shared
// leader flag the reconciler consults before it deletes anything. Only the elected
// replica performs deletions; the others keep watching and stay ready to take over.
type gcLeaderRunnable struct {
	lock      resourcelock.Interface
	setLeader func(bool)
	identity  string
}

func (r *gcLeaderRunnable) Run(ctx context.Context) error {
	cfg := leaderelection.LeaderElectionConfig{
		Lock:            r.lock,
		Name:            gcLeaseName,
		ReleaseOnCancel: true,
		LeaseDuration:   gcLeaseDuration,
		RenewDeadline:   gcRenewDeadline,
		RetryPeriod:     gcRetryPeriod,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: func(context.Context) {
				r.setLeader(true)
				logging.DefaultLogger.Info("coordination GC acquired leadership", "identity", r.identity)
			},
			OnStoppedLeading: func() {
				r.setLeader(false)
				logging.DefaultLogger.Info("coordination GC lost leadership", "identity", r.identity)
			},
		},
	}

	// RunOrDie returns when leadership is lost or the context is cancelled. Re-contend
	// until shutdown so a replica that loses the lease can reacquire it later.
	for ctx.Err() == nil {
		leaderelection.RunOrDie(ctx, cfg)
		select {
		case <-ctx.Done():
		case <-time.After(gcRetryPeriod):
		}
	}
	return ctx.Err()
}

// gcIdentity returns a per-process holder identity of the form "<hostname>_<pid>",
// matching the "<pod>_<uid>" convention leases use elsewhere.
func gcIdentity() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "unknown"
	}
	return fmt.Sprintf("%s_%d", host, os.Getpid())
}

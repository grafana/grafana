// Package leaderelection provides the reusable pieces for running leader
// election on a coordination.grafana.app ClusterLease: a client-go
// resourcelock.Interface backed by the served ClusterLease API, and a
// re-contending election loop. It lives in the coordination module so both the
// coordination app's own garbage collector and main-module consumers (via
// pkg/infra/leaderelection/clusterlease) share one implementation.
package leaderelection

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sle "k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

// Timings configures the election cadence. All three are written to the
// ClusterLease's leaseDurationSeconds (as LeaseDuration) so LeaseDuration must
// stay within the admission bounds ([10, 600]s).
type Timings struct {
	LeaseDuration time.Duration
	RenewDeadline time.Duration
	RetryPeriod   time.Duration
}

// NewLock returns a resourcelock.Interface backed by the coordination
// ClusterLease named `name`, using `client` (a client for the ClusterLease kind)
// and holder `identity`.
func NewLock(client resource.Client, name, identity string) resourcelock.Interface {
	return &clusterLeaseLock{client: client, name: name, identity: identity}
}

// DefaultIdentity returns a per-process holder identity of the form
// "<hostname>_<pid>", matching the "<pod>_<uid>" convention leases use elsewhere.
func DefaultIdentity() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "unknown"
	}
	return fmt.Sprintf("%s_%d", host, os.Getpid())
}

// Run contends for leadership on the lock and invokes callbacks, re-contending
// after any leadership loss until ctx is cancelled. It uses client-go's
// RunOrDie, which — unlike a single NewLeaderElector().Run — tolerates leadership
// loss, so a replica that loses the lease can reacquire it later.
func Run(ctx context.Context, lock resourcelock.Interface, name string, t Timings, callbacks k8sle.LeaderCallbacks) {
	cfg := k8sle.LeaderElectionConfig{
		Lock:            lock,
		Name:            name,
		ReleaseOnCancel: true,
		LeaseDuration:   t.LeaseDuration,
		RenewDeadline:   t.RenewDeadline,
		RetryPeriod:     t.RetryPeriod,
		Callbacks:       callbacks,
	}
	for ctx.Err() == nil {
		k8sle.RunOrDie(ctx, cfg)
		select {
		case <-ctx.Done():
		case <-time.After(t.RetryPeriod):
		}
	}
}

// clusterLeaseLock adapts a coordination ClusterLease to client-go's
// resourcelock.Interface. The lock stores the resourceVersion of the last
// observed lease and uses it as an update precondition, giving the same
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
	record := toRecord(cl.Spec)
	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, nil, err
	}
	return &record, recordBytes, nil
}

func (l *clusterLeaseLock) Create(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	cl := &coordinationv0alpha1.ClusterLease{}
	cl.SetName(l.name)
	fromRecord(&cl.Spec, ler)
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
	fromRecord(&cl.Spec, ler)
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

// toRecord maps a ClusterLease spec onto client-go's election record.
func toRecord(spec coordinationv0alpha1.ClusterLeaseSpec) resourcelock.LeaderElectionRecord {
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

// fromRecord maps client-go's election record onto a ClusterLease spec.
// Timestamps become RFC3339 strings, matching the kind's schema.
func fromRecord(spec *coordinationv0alpha1.ClusterLeaseSpec, r resourcelock.LeaderElectionRecord) {
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

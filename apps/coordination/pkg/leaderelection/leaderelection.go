// Package leaderelection provides the reusable pieces for running leader
// election on a coordination.grafana.app GlobalLease: a client-go
// resourcelock.Interface backed by the served GlobalLease API, and a
// re-contending election loop. It lives in the coordination module so both the
// coordination app's own garbage collector and main-module consumers (via
// pkg/infra/leaderelection/globallease) share one implementation.
package leaderelection

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sle "k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

// Timings configures the election cadence. All three are written to the
// GlobalLease's leaseDurationSeconds (as LeaseDuration) so LeaseDuration must
// stay within the admission bounds ([10, 600]s).
type Timings struct {
	LeaseDuration time.Duration
	RenewDeadline time.Duration
	RetryPeriod   time.Duration
}

// NewGlobalLock returns a resourcelock.Interface backed by the coordination
// GlobalLease named `name`, using `client` (a client for the GlobalLease kind)
// and holder `identity`.
func NewGlobalLock(client resource.Client, name, identity string) resourcelock.Interface {
	return &globalLeaseLock{client: client, name: name, identity: identity}
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

// globalLeaseLock adapts a coordination GlobalLease to client-go's
// resourcelock.Interface. The lock stores the resourceVersion of the last
// observed lease and uses it as an update precondition, giving the same
// compare-and-swap acquisition client-go expects from a native Lease.
type globalLeaseLock struct {
	client   resource.Client
	name     string
	identity string
	lastRV   string
}

var _ resourcelock.Interface = (*globalLeaseLock)(nil)

func (l *globalLeaseLock) Get(ctx context.Context) (*resourcelock.LeaderElectionRecord, []byte, error) {
	obj, err := l.client.Get(ctx, resource.Identifier{Name: l.name})
	if err != nil {
		return nil, nil, err
	}
	cl, ok := obj.(*coordinationv0alpha1.GlobalLease)
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

func (l *globalLeaseLock) Create(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	cl := &coordinationv0alpha1.GlobalLease{}
	cl.SetName(l.name)
	fromRecord(&cl.Spec, ler)
	created, err := l.client.Create(ctx, resource.Identifier{Name: l.name}, cl, resource.CreateOptions{})
	if err != nil {
		return err
	}
	l.lastRV = created.GetResourceVersion()
	return nil
}

func (l *globalLeaseLock) Update(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	if l.lastRV == "" {
		return fmt.Errorf("cluster lease %q not fetched before update", l.name)
	}
	cl := &coordinationv0alpha1.GlobalLease{}
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

func (l *globalLeaseLock) RecordEvent(string) {}
func (l *globalLeaseLock) Identity() string   { return l.identity }
func (l *globalLeaseLock) Describe() string {
	return "globalleases.coordination.grafana.app/" + l.name
}

// NewNamespacedLock returns a resourcelock.Interface backed by the namespaced
// coordination Lease named `name` in `namespace`, using `client` (a client for the
// Lease kind) and holder `identity`. Use it for tenant-scoped leader election, where
// the lease lives in the tenant's own namespace.
func NewNamespacedLock(client resource.Client, namespace, name, identity string) resourcelock.Interface {
	return &namespacedLeaseLock{client: client, id: resource.Identifier{Namespace: namespace, Name: name}, identity: identity}
}

// namespacedLeaseLock is the namespaced Lease counterpart of globalLeaseLock.
type namespacedLeaseLock struct {
	client   resource.Client
	id       resource.Identifier
	identity string
	lastRV   string
}

var _ resourcelock.Interface = (*namespacedLeaseLock)(nil)

func (l *namespacedLeaseLock) Get(ctx context.Context) (*resourcelock.LeaderElectionRecord, []byte, error) {
	obj, err := l.client.Get(ctx, l.id)
	if err != nil {
		return nil, nil, err
	}
	lease, ok := obj.(*coordinationv0alpha1.Lease)
	if !ok {
		return nil, nil, fmt.Errorf("unexpected object type %T for lease %q", obj, l.id.Name)
	}
	l.lastRV = lease.GetResourceVersion()
	record := leaseToRecord(lease.Spec)
	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, nil, err
	}
	return &record, recordBytes, nil
}

func (l *namespacedLeaseLock) Create(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	lease := &coordinationv0alpha1.Lease{}
	lease.SetNamespace(l.id.Namespace)
	lease.SetName(l.id.Name)
	fromLeaseRecord(&lease.Spec, ler)
	created, err := l.client.Create(ctx, l.id, lease, resource.CreateOptions{})
	if err != nil {
		return err
	}
	l.lastRV = created.GetResourceVersion()
	return nil
}

func (l *namespacedLeaseLock) Update(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	if l.lastRV == "" {
		return fmt.Errorf("lease %q not fetched before update", l.id.Name)
	}
	lease := &coordinationv0alpha1.Lease{}
	lease.SetNamespace(l.id.Namespace)
	lease.SetName(l.id.Name)
	fromLeaseRecord(&lease.Spec, ler)
	updated, err := l.client.Update(ctx, l.id, lease, resource.UpdateOptions{ResourceVersion: l.lastRV})
	if err != nil {
		return err
	}
	l.lastRV = updated.GetResourceVersion()
	return nil
}

func (l *namespacedLeaseLock) RecordEvent(string) {}
func (l *namespacedLeaseLock) Identity() string   { return l.identity }
func (l *namespacedLeaseLock) Describe() string {
	return "leases.coordination.grafana.app/" + l.id.Namespace + "/" + l.id.Name
}

// Object-lease annotation keys. An object lease stores the leader-election record in
// an existing object's annotations instead of a dedicated Lease resource; the
// object's own resourceVersion provides the compare-and-swap.
const (
	AnnotationHolderIdentity   = "coordination.grafana.app/holder-identity"
	AnnotationLeaseDurationSec = "coordination.grafana.app/lease-duration-seconds"
	AnnotationAcquireTime      = "coordination.grafana.app/acquire-time"
	AnnotationRenewTime        = "coordination.grafana.app/renew-time"
	AnnotationLeaseTransitions = "coordination.grafana.app/lease-transitions"
)

// NewObjectLock returns a resourcelock.Interface that stores the leader-election
// record in the annotations of an existing object (identified by id), using client
// (a client for that object's kind) and holder identity. Unlike NewGlobalLock it never
// creates a dedicated lease object: the target must already exist and its
// resourceVersion provides the compare-and-swap. Use it to lease an object in place
// rather than parking a separate GlobalLease.
//
// Note: each renewal writes the target object's annotations, bumping its
// resourceVersion — so a controller watching that object will observe the renewals.
// Object leases suit objects without a hot reconciler, or reconcilers that ignore
// annotation-only changes.
func NewObjectLock(client resource.Client, id resource.Identifier, identity string) resourcelock.Interface {
	return &objectLeaseLock{client: client, id: id, identity: identity}
}

// objectLeaseLock adapts an existing object's annotations to client-go's
// resourcelock.Interface, using the object's resourceVersion as the update
// precondition.
type objectLeaseLock struct {
	client   resource.Client
	id       resource.Identifier
	identity string
	lastObj  resource.Object
	lastRV   string
}

var _ resourcelock.Interface = (*objectLeaseLock)(nil)

func (l *objectLeaseLock) Get(ctx context.Context) (*resourcelock.LeaderElectionRecord, []byte, error) {
	obj, err := l.client.Get(ctx, l.id)
	if err != nil {
		return nil, nil, err
	}
	l.lastObj = obj
	l.lastRV = obj.GetResourceVersion()
	record := annotationsToRecord(obj.GetAnnotations())
	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, nil, err
	}
	return &record, recordBytes, nil
}

// Create is never used for object leases: the target object must already exist, so
// Get does not return NotFound — the only case in which client-go calls Create.
func (l *objectLeaseLock) Create(_ context.Context, _ resourcelock.LeaderElectionRecord) error {
	return fmt.Errorf("object %q must exist before it can be leased", l.id.Name)
}

func (l *objectLeaseLock) Update(ctx context.Context, ler resourcelock.LeaderElectionRecord) error {
	if l.lastObj == nil {
		return fmt.Errorf("object %q not fetched before update", l.id.Name)
	}
	obj := l.lastObj.Copy()
	setLeaseAnnotations(obj, ler)
	updated, err := l.client.Update(ctx, l.id, obj, resource.UpdateOptions{ResourceVersion: l.lastRV})
	if err != nil {
		return err
	}
	l.lastObj = updated
	l.lastRV = updated.GetResourceVersion()
	return nil
}

func (l *objectLeaseLock) RecordEvent(string) {}
func (l *objectLeaseLock) Identity() string   { return l.identity }
func (l *objectLeaseLock) Describe() string {
	if l.id.Namespace != "" {
		return l.id.Namespace + "/" + l.id.Name
	}
	return l.id.Name
}

// annotationsToRecord reads an object-lease record from an object's annotations.
func annotationsToRecord(anns map[string]string) resourcelock.LeaderElectionRecord {
	r := resourcelock.LeaderElectionRecord{}
	if anns == nil {
		return r
	}
	r.HolderIdentity = anns[AnnotationHolderIdentity]
	if v, err := strconv.Atoi(anns[AnnotationLeaseDurationSec]); err == nil {
		r.LeaseDurationSeconds = v
	}
	if v, err := strconv.Atoi(anns[AnnotationLeaseTransitions]); err == nil {
		r.LeaderTransitions = v
	}
	if t, err := time.Parse(time.RFC3339, anns[AnnotationAcquireTime]); err == nil {
		r.AcquireTime = metav1.NewTime(t)
	}
	if t, err := time.Parse(time.RFC3339, anns[AnnotationRenewTime]); err == nil {
		r.RenewTime = metav1.NewTime(t)
	}
	return r
}

// setLeaseAnnotations writes an object-lease record into an object's annotations,
// preserving any other annotations.
func setLeaseAnnotations(obj resource.Object, r resourcelock.LeaderElectionRecord) {
	anns := obj.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	anns[AnnotationHolderIdentity] = r.HolderIdentity
	anns[AnnotationLeaseDurationSec] = strconv.Itoa(r.LeaseDurationSeconds)
	anns[AnnotationLeaseTransitions] = strconv.Itoa(r.LeaderTransitions)
	if !r.AcquireTime.IsZero() {
		anns[AnnotationAcquireTime] = r.AcquireTime.UTC().Format(time.RFC3339)
	}
	if !r.RenewTime.IsZero() {
		anns[AnnotationRenewTime] = r.RenewTime.UTC().Format(time.RFC3339)
	}
	obj.SetAnnotations(anns)
}

// recordFromLeaseFields builds an election record from the shared lease spec fields
// (Lease and GlobalLease have the same field set).
func recordFromLeaseFields(holder *string, durationSeconds, transitions *int32, acquire, renew *string) resourcelock.LeaderElectionRecord {
	r := resourcelock.LeaderElectionRecord{}
	if holder != nil {
		r.HolderIdentity = *holder
	}
	if durationSeconds != nil {
		r.LeaseDurationSeconds = int(*durationSeconds)
	}
	if transitions != nil {
		r.LeaderTransitions = int(*transitions)
	}
	if acquire != nil {
		if t, err := time.Parse(time.RFC3339, *acquire); err == nil {
			r.AcquireTime = metav1.NewTime(t)
		}
	}
	if renew != nil {
		if t, err := time.Parse(time.RFC3339, *renew); err == nil {
			r.RenewTime = metav1.NewTime(t)
		}
	}
	return r
}

// leaseFieldsFromRecord maps an election record onto the shared lease spec fields.
// Timestamps become RFC3339 strings, matching the kinds' schema.
func leaseFieldsFromRecord(r resourcelock.LeaderElectionRecord) (holder *string, durationSeconds, transitions *int32, acquire, renew *string) {
	h := r.HolderIdentity
	holder = &h
	d := int32(r.LeaseDurationSeconds)
	durationSeconds = &d
	tr := int32(r.LeaderTransitions)
	transitions = &tr
	if !r.AcquireTime.IsZero() {
		s := r.AcquireTime.UTC().Format(time.RFC3339)
		acquire = &s
	}
	if !r.RenewTime.IsZero() {
		s := r.RenewTime.UTC().Format(time.RFC3339)
		renew = &s
	}
	return holder, durationSeconds, transitions, acquire, renew
}

// toRecord / fromRecord map a GlobalLease spec.
func toRecord(spec coordinationv0alpha1.GlobalLeaseSpec) resourcelock.LeaderElectionRecord {
	return recordFromLeaseFields(spec.HolderIdentity, spec.LeaseDurationSeconds, spec.LeaseTransitions, spec.AcquireTime, spec.RenewTime)
}

func fromRecord(spec *coordinationv0alpha1.GlobalLeaseSpec, r resourcelock.LeaderElectionRecord) {
	spec.HolderIdentity, spec.LeaseDurationSeconds, spec.LeaseTransitions, spec.AcquireTime, spec.RenewTime = leaseFieldsFromRecord(r)
}

// leaseToRecord / fromLeaseRecord map a namespaced Lease spec.
func leaseToRecord(spec coordinationv0alpha1.LeaseSpec) resourcelock.LeaderElectionRecord {
	return recordFromLeaseFields(spec.HolderIdentity, spec.LeaseDurationSeconds, spec.LeaseTransitions, spec.AcquireTime, spec.RenewTime)
}

func fromLeaseRecord(spec *coordinationv0alpha1.LeaseSpec, r resourcelock.LeaderElectionRecord) {
	spec.HolderIdentity, spec.LeaseDurationSeconds, spec.LeaseTransitions, spec.AcquireTime, spec.RenewTime = leaseFieldsFromRecord(r)
}

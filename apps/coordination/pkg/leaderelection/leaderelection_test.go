package leaderelection

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

func TestRecordRoundTrip(t *testing.T) {
	acquire := time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)
	renew := time.Date(2026, 8, 18, 10, 0, 12, 0, time.UTC)
	in := resourcelock.LeaderElectionRecord{
		HolderIdentity:       "host_1",
		LeaseDurationSeconds: 15,
		LeaderTransitions:    3,
		AcquireTime:          metav1.NewTime(acquire),
		RenewTime:            metav1.NewTime(renew),
	}

	var spec coordinationv0alpha1.ClusterLeaseSpec
	fromRecord(&spec, in)

	require.Equal(t, "host_1", *spec.HolderIdentity)
	require.Equal(t, int32(15), *spec.LeaseDurationSeconds)
	require.Equal(t, int32(3), *spec.LeaseTransitions)
	// The election lease duration must satisfy the ClusterLease admission bounds.
	require.GreaterOrEqual(t, *spec.LeaseDurationSeconds, int32(10))
	require.LessOrEqual(t, *spec.LeaseDurationSeconds, int32(600))

	out := toRecord(spec)
	require.Equal(t, in.HolderIdentity, out.HolderIdentity)
	require.Equal(t, in.LeaseDurationSeconds, out.LeaseDurationSeconds)
	require.Equal(t, in.LeaderTransitions, out.LeaderTransitions)
	require.True(t, in.AcquireTime.Equal(&out.AcquireTime))
	require.True(t, in.RenewTime.Equal(&out.RenewTime))
}

// fakeLockClient implements the Get/Create/Update subset the lock needs, tracking
// the resourceVersion the lock supplies as an update precondition.
type fakeLockClient struct {
	resource.Client
	obj      *coordinationv0alpha1.ClusterLease
	updateRV []string
}

func (f *fakeLockClient) Get(_ context.Context, _ resource.Identifier) (resource.Object, error) {
	return f.obj, nil
}

func (f *fakeLockClient) Create(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	cl := obj.(*coordinationv0alpha1.ClusterLease)
	cl.ResourceVersion = "1"
	f.obj = cl
	return cl, nil
}

func (f *fakeLockClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	f.updateRV = append(f.updateRV, opts.ResourceVersion)
	cl := obj.(*coordinationv0alpha1.ClusterLease)
	cl.ResourceVersion = "2"
	f.obj = cl
	return cl, nil
}

func TestLockCASThreadsResourceVersion(t *testing.T) {
	client := &fakeLockClient{}
	lock := NewLock(client, "coordination-gc", "me_1")

	require.Equal(t, "me_1", lock.Identity())

	// Create records the returned resourceVersion.
	require.NoError(t, lock.Create(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 15,
	}))

	// Update must present the resourceVersion from the create as its CAS precondition.
	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 15,
	}))
	require.Equal(t, []string{"1"}, client.updateRV)

	// A second update presents the resourceVersion the previous update returned.
	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 15,
	}))
	require.Equal(t, []string{"1", "2"}, client.updateRV)
}

func TestLockUpdateBeforeGetFails(t *testing.T) {
	lock := NewLock(&fakeLockClient{}, "coordination-gc", "me_1")
	err := lock.Update(context.Background(), resourcelock.LeaderElectionRecord{HolderIdentity: "me_1"})
	require.Error(t, err, "update without a prior get/create has no resourceVersion to CAS against")
}

func TestDefaultIdentity(t *testing.T) {
	id := DefaultIdentity()
	require.NotEmpty(t, id)
	require.Contains(t, id, "_")
}

func TestObjectLeaseAnnotationsRoundTrip(t *testing.T) {
	acquire := time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)
	renew := time.Date(2026, 8, 18, 10, 0, 30, 0, time.UTC)
	in := resourcelock.LeaderElectionRecord{
		HolderIdentity:       "holder_1",
		LeaseDurationSeconds: 45,
		LeaderTransitions:    2,
		AcquireTime:          metav1.NewTime(acquire),
		RenewTime:            metav1.NewTime(renew),
	}

	// Unrelated annotations must be preserved.
	obj := &coordinationv0alpha1.Lease{}
	obj.SetAnnotations(map[string]string{"keep": "yes"})
	setLeaseAnnotations(obj, in)
	require.Equal(t, "yes", obj.GetAnnotations()["keep"])

	out := annotationsToRecord(obj.GetAnnotations())
	require.Equal(t, in.HolderIdentity, out.HolderIdentity)
	require.Equal(t, in.LeaseDurationSeconds, out.LeaseDurationSeconds)
	require.Equal(t, in.LeaderTransitions, out.LeaderTransitions)
	require.True(t, in.AcquireTime.Equal(&out.AcquireTime))
	require.True(t, in.RenewTime.Equal(&out.RenewTime))
}

// fakeObjectClient is a resource.Client whose Get/Update operate on a single stored
// object, tracking the resourceVersion the object lock supplies as an update
// precondition.
type fakeObjectClient struct {
	resource.Client
	obj      *coordinationv0alpha1.Lease
	updateRV []string
}

func (f *fakeObjectClient) Get(_ context.Context, _ resource.Identifier) (resource.Object, error) {
	return f.obj, nil
}

func (f *fakeObjectClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	f.updateRV = append(f.updateRV, opts.ResourceVersion)
	o := obj.(*coordinationv0alpha1.Lease)
	o.SetResourceVersion("rv2")
	f.obj = o
	return o, nil
}

func TestObjectLeaseLock(t *testing.T) {
	target := &coordinationv0alpha1.Lease{}
	target.SetName("target")
	target.SetResourceVersion("rv1")
	client := &fakeObjectClient{obj: target}

	lock := NewObjectLock(client, resource.Identifier{Namespace: "ns", Name: "target"}, "me_1")
	require.Equal(t, "me_1", lock.Identity())
	require.Equal(t, "ns/target", lock.Describe())

	// A never-leased object yields an empty record.
	rec, _, err := lock.Get(context.Background())
	require.NoError(t, err)
	require.Empty(t, rec.HolderIdentity)

	// Acquire writes the record into the object's annotations, CAS'd on the observed RV.
	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 30, LeaderTransitions: 1,
	}))
	require.Equal(t, []string{"rv1"}, client.updateRV)
	require.Equal(t, "me_1", client.obj.GetAnnotations()[AnnotationHolderIdentity])

	// A subsequent read reflects the acquired lease.
	rec2, _, err := lock.Get(context.Background())
	require.NoError(t, err)
	require.Equal(t, "me_1", rec2.HolderIdentity)
	require.Equal(t, 30, rec2.LeaseDurationSeconds)
	require.Equal(t, 1, rec2.LeaderTransitions)

	// The next update presents the RV the previous update returned.
	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 30, LeaderTransitions: 1,
	}))
	require.Equal(t, []string{"rv1", "rv2"}, client.updateRV)
}

func TestObjectLeaseLock_CreateAndUpdateGuards(t *testing.T) {
	// Create is never valid: an object lease targets an existing object.
	lock := NewObjectLock(&fakeObjectClient{}, resource.Identifier{Name: "x"}, "me")
	require.Error(t, lock.Create(context.Background(), resourcelock.LeaderElectionRecord{}))

	// Update before a successful Get has no resourceVersion to CAS against.
	require.Error(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{HolderIdentity: "me"}))
}

func TestLeaseRecordRoundTrip(t *testing.T) {
	acquire := time.Date(2026, 8, 18, 9, 0, 0, 0, time.UTC)
	renew := time.Date(2026, 8, 18, 9, 0, 20, 0, time.UTC)
	in := resourcelock.LeaderElectionRecord{
		HolderIdentity:       "host_1",
		LeaseDurationSeconds: 20,
		LeaderTransitions:    4,
		AcquireTime:          metav1.NewTime(acquire),
		RenewTime:            metav1.NewTime(renew),
	}

	var spec coordinationv0alpha1.LeaseSpec
	fromLeaseRecord(&spec, in)
	require.Equal(t, "host_1", *spec.HolderIdentity)
	require.Equal(t, int32(20), *spec.LeaseDurationSeconds)
	require.Equal(t, int32(4), *spec.LeaseTransitions)

	out := leaseToRecord(spec)
	require.Equal(t, in.HolderIdentity, out.HolderIdentity)
	require.Equal(t, in.LeaseDurationSeconds, out.LeaseDurationSeconds)
	require.Equal(t, in.LeaderTransitions, out.LeaderTransitions)
	require.True(t, in.AcquireTime.Equal(&out.AcquireTime))
	require.True(t, in.RenewTime.Equal(&out.RenewTime))
}

type fakeNamespacedLeaseClient struct {
	resource.Client
	obj      *coordinationv0alpha1.Lease
	updateRV []string
}

func (f *fakeNamespacedLeaseClient) Get(_ context.Context, _ resource.Identifier) (resource.Object, error) {
	return f.obj, nil
}

func (f *fakeNamespacedLeaseClient) Create(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	l := obj.(*coordinationv0alpha1.Lease)
	l.ResourceVersion = "1"
	f.obj = l
	return l, nil
}

func (f *fakeNamespacedLeaseClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	f.updateRV = append(f.updateRV, opts.ResourceVersion)
	l := obj.(*coordinationv0alpha1.Lease)
	l.ResourceVersion = "2"
	f.obj = l
	return l, nil
}

func TestNamespacedLeaseLock_CAS(t *testing.T) {
	client := &fakeNamespacedLeaseClient{}
	lock := NewNamespacedLock(client, "stacks-1", "reporting", "me_1")

	require.Equal(t, "me_1", lock.Identity())
	require.Equal(t, "leases.coordination.grafana.app/stacks-1/reporting", lock.Describe())

	require.NoError(t, lock.Create(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 30, LeaderTransitions: 1,
	}))
	require.Equal(t, "stacks-1", client.obj.GetNamespace())
	require.Equal(t, "reporting", client.obj.GetName())
	require.Equal(t, "me_1", *client.obj.Spec.HolderIdentity)

	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 30, LeaderTransitions: 1,
	}))
	require.Equal(t, []string{"1"}, client.updateRV)

	require.NoError(t, lock.Update(context.Background(), resourcelock.LeaderElectionRecord{
		HolderIdentity: "me_1", LeaseDurationSeconds: 30, LeaderTransitions: 1,
	}))
	require.Equal(t, []string{"1", "2"}, client.updateRV)
}

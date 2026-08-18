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

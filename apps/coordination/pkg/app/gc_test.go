package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

// fakeClient records Delete calls; all other resource.Client methods panic (unused).
type fakeClient struct {
	resource.Client
	deleted   []resource.Identifier
	deletedRV []string
	err       error
}

func (f *fakeClient) Delete(_ context.Context, id resource.Identifier, opts resource.DeleteOptions) error {
	f.deleted = append(f.deleted, id)
	f.deletedRV = append(f.deletedRV, opts.Preconditions.ResourceVersion)
	return f.err
}

var gcNow = time.Date(2026, 8, 18, 12, 0, 0, 0, time.UTC)

func newReconciler(lease, cluster *fakeClient) *leaseGCReconciler {
	return &leaseGCReconciler{
		leaseClient:        lease,
		clusterLeaseClient: cluster,
		gracePeriod:        24 * time.Hour,
		now:                func() time.Time { return gcNow },
	}
}

func clusterLeaseAt(name, renewOffset string, durationSeconds int32, rv string, renew time.Duration) *coordinationv0alpha1.ClusterLease {
	l := &coordinationv0alpha1.ClusterLease{}
	l.Name = name
	l.ResourceVersion = rv
	d := durationSeconds
	l.Spec.LeaseDurationSeconds = &d
	if renewOffset != "skip" {
		rt := gcNow.Add(renew).Format(time.RFC3339)
		l.Spec.RenewTime = &rt
	}
	return l
}

func reconcile(t *testing.T, r *leaseGCReconciler, obj resource.Object, action operator.ReconcileAction) operator.ReconcileResult {
	t.Helper()
	res, err := r.Reconcile(context.Background(), operator.ReconcileRequest{Action: action, Object: obj})
	require.NoError(t, err)
	return res
}

func TestGC_FreshLeaseRequeuesNotDeleted(t *testing.T) {
	cluster := &fakeClient{}
	r := newReconciler(&fakeClient{}, cluster)

	// renewed now, duration 30s, grace 24h → eligible in ~24h0m30s.
	res := reconcile(t, r, clusterLeaseAt("x", "", 30, "10", 0), operator.ReconcileActionCreated)

	require.Empty(t, cluster.deleted, "a fresh lease must not be deleted")
	require.NotNil(t, res.RequeueAfter)
	require.InDelta(t, (24*time.Hour + 30*time.Second).Seconds(), res.RequeueAfter.Seconds(), 1)
}

func TestGC_ExpiredWithinGraceRequeues(t *testing.T) {
	cluster := &fakeClient{}
	r := newReconciler(&fakeClient{}, cluster)

	// renewed 1h ago, duration 30s → expired, but only ~1h into the 24h grace.
	res := reconcile(t, r, clusterLeaseAt("x", "", 30, "10", -time.Hour), operator.ReconcileActionUpdated)

	require.Empty(t, cluster.deleted, "expired-but-within-grace must not be deleted")
	require.NotNil(t, res.RequeueAfter)
	require.Greater(t, res.RequeueAfter.Seconds(), 0.0)
}

func TestGC_ExpiredPastGraceDeletedWithRVPrecondition(t *testing.T) {
	cluster := &fakeClient{}
	r := newReconciler(&fakeClient{}, cluster)

	// renewed 25h ago, duration 30s, grace 24h → past the grace period.
	res := reconcile(t, r, clusterLeaseAt("x", "", 30, "42", -25*time.Hour), operator.ReconcileActionUpdated)

	require.Nil(t, res.RequeueAfter)
	require.Equal(t, []resource.Identifier{{Namespace: "", Name: "x"}}, cluster.deleted)
	require.Equal(t, []string{"42"}, cluster.deletedRV, "delete must carry the observed resourceVersion")
}

func TestGC_RoutesNamespacedLeaseToLeaseClient(t *testing.T) {
	lease := &fakeClient{}
	cluster := &fakeClient{}
	r := newReconciler(lease, cluster)

	l := &coordinationv0alpha1.Lease{}
	l.Name = "n"
	l.Namespace = "stacks-1"
	l.ResourceVersion = "7"
	d := int32(30)
	l.Spec.LeaseDurationSeconds = &d
	rt := gcNow.Add(-25 * time.Hour).Format(time.RFC3339)
	l.Spec.RenewTime = &rt

	reconcile(t, r, l, operator.ReconcileActionUpdated)

	require.Equal(t, []resource.Identifier{{Namespace: "stacks-1", Name: "n"}}, lease.deleted)
	require.Empty(t, cluster.deleted, "namespaced Lease must not go to the ClusterLease client")
}

func TestGC_SkipsDeleteAndMalformed(t *testing.T) {
	cluster := &fakeClient{}
	r := newReconciler(&fakeClient{}, cluster)

	// Delete action is a no-op.
	reconcile(t, r, clusterLeaseAt("x", "", 30, "1", -25*time.Hour), operator.ReconcileActionDeleted)
	require.Empty(t, cluster.deleted)

	// Missing renewTime: not enough info to expire.
	reconcile(t, r, clusterLeaseAt("x", "skip", 30, "1", 0), operator.ReconcileActionUpdated)
	require.Empty(t, cluster.deleted)

	// Malformed renewTime: left for a human.
	bad := &coordinationv0alpha1.ClusterLease{}
	bad.Name = "x"
	d := int32(30)
	bad.Spec.LeaseDurationSeconds = &d
	garbage := "not-a-timestamp"
	bad.Spec.RenewTime = &garbage
	reconcile(t, r, bad, operator.ReconcileActionUpdated)
	require.Empty(t, cluster.deleted)
}

func TestGC_ToleratesNotFoundAndConflict(t *testing.T) {
	gr := schema.GroupResource{Group: "coordination.grafana.app", Resource: "clusterleases"}
	for _, tc := range []struct {
		name string
		err  error
	}{
		{"not found", apierrors.NewNotFound(gr, "x")},
		{"conflict (renewed under us)", apierrors.NewConflict(gr, "x", errors.New("rv mismatch"))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cluster := &fakeClient{err: tc.err}
			r := newReconciler(&fakeClient{}, cluster)
			_, err := r.Reconcile(context.Background(), operator.ReconcileRequest{
				Action: operator.ReconcileActionUpdated,
				Object: clusterLeaseAt("x", "", 30, "1", -25*time.Hour),
			})
			require.NoError(t, err, "%s must not surface as a reconcile error", tc.name)
		})
	}
}

package coordination

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var (
	leaseGVR       = coordinationv0alpha1.LeaseKind().GroupVersionResource()
	globalLeaseGVR = coordinationv0alpha1.GlobalLeaseKind().GroupVersionResource()
)

const (
	ownerAnnotation = "coordination.grafana.app/owner-id"
	ownerLabel      = "coordination.grafana.app/owner"
)

func newHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // unified storage
		DisableAnonymous:     true,
		APIServerStorageType: options.StorageTypeUnified,
		EnableFeatureToggles: []string{featuremgmt.FlagCoordinationLeasesApi},
	})
}

// lease builds a namespaced Lease payload.
func lease(name, holder, renewTime string, durationSeconds int64) *unstructured.Unstructured {
	return leaseOfKind("Lease", name, holder, renewTime, durationSeconds)
}

// globalLease builds a cluster-scoped GlobalLease payload.
func globalLease(name, holder, renewTime string, durationSeconds int64) *unstructured.Unstructured {
	return leaseOfKind("GlobalLease", name, holder, renewTime, durationSeconds)
}

func leaseOfKind(kind, name, holder, renewTime string, durationSeconds int64) *unstructured.Unstructured {
	spec := map[string]any{
		"holderIdentity":       holder,
		"leaseDurationSeconds": durationSeconds,
	}
	if renewTime != "" {
		spec["renewTime"] = renewTime
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": coordinationv0alpha1.APIGroup + "/" + coordinationv0alpha1.APIVersion,
		"kind":       kind,
		"metadata":   map[string]any{"name": name},
		"spec":       spec,
	}}
}

// clusterClientForToken builds a cluster-scoped dynamic client authenticating with a
// service-account token. GetResourceClient can't serve cluster scope with a token (it
// requires a namespace), so we construct the client directly.
func clusterClientForToken(t *testing.T, helper *apis.K8sTestHelper, token string) dynamic.ResourceInterface {
	t.Helper()
	cfg := &rest.Config{
		Host:        "http://" + helper.GetListenerAddress(),
		BearerToken: token,
	}
	dc, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	return dc.Resource(globalLeaseGVR)
}

func TestIntegrationCoordination(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := newHelper(t)
	ctx := context.Background()

	t.Run("namespaced Lease CRUD as grafana admin", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: leaseGVR})

		created, err := client.Resource.Create(ctx, lease("crud", "pod-a_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "crud", created.GetName())

		got, err := client.Resource.Get(ctx, "crud", metav1.GetOptions{})
		require.NoError(t, err)
		holder, _, _ := unstructured.NestedString(got.Object, "spec", "holderIdentity")
		require.Equal(t, "pod-a_1", holder)

		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, list.Items)

		require.NoError(t, unstructured.SetNestedField(got.Object, "2026-08-18T12:00:10Z", "spec", "renewTime"))
		_, err = client.Resource.Update(ctx, got, metav1.UpdateOptions{})
		require.NoError(t, err)

		require.NoError(t, client.Resource.Delete(ctx, "crud", metav1.DeleteOptions{}))
		_, err = client.Resource.Get(ctx, "crud", metav1.GetOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "expected NotFound after delete, got %v", err)
	})

	t.Run("namespaced Lease is watchable", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: leaseGVR})

		w, err := client.Resource.Watch(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		_, err = client.Resource.Create(ctx, lease("watched", "pod-a_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Resource.Delete(ctx, "watched", metav1.DeleteOptions{}) })

		select {
		case ev := <-w.ResultChan():
			require.Equal(t, watch.Added, ev.Type)
		case <-time.After(10 * time.Second):
			t.Fatal("did not receive a watch event for the created lease")
		}
	})

	t.Run("admission enforces leaseDurationSeconds bounds", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: leaseGVR})

		_, err := client.Resource.Create(ctx, lease("too-short", "pod-a_1", "2026-08-18T12:00:00Z", 5), metav1.CreateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "leaseDurationSeconds must be between")

		_, err = client.Resource.Create(ctx, lease("too-long", "pod-a_1", "2026-08-18T12:00:00Z", 601), metav1.CreateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "leaseDurationSeconds must be between")
	})

	t.Run("admission forbids holder change without advancing renewTime", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: leaseGVR})

		created, err := client.Resource.Create(ctx, lease("takeover", "pod-a_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Resource.Delete(ctx, "takeover", metav1.DeleteOptions{}) })

		// New holder, same renewTime → rejected.
		require.NoError(t, unstructured.SetNestedField(created.Object, "pod-b_2", "spec", "holderIdentity"))
		_, err = client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "holderIdentity changed without advancing renewTime")
	})

	t.Run("authz denies identities without the coordination role", func(t *testing.T) {
		// Viewers and editors are not service identities and hold no coordination
		// action, so fine-grained RBAC denies them.
		for _, u := range []struct {
			name string
			args apis.ResourceClientArgs
		}{
			{"org1 viewer", apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: leaseGVR}},
			{"org1 editor", apis.ResourceClientArgs{User: helper.Org1.Editor, GVR: leaseGVR}},
		} {
			t.Run(u.name, func(t *testing.T) {
				client := helper.GetResourceClient(u.args)
				_, err := client.Resource.Create(ctx, lease("denied", "x_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
				require.Error(t, err)
				require.Equalf(t, metav1.StatusReasonForbidden, helper.AsStatusError(err).Status().Reason,
					"%s should be forbidden, got %v", u.name, err)

				_, err = client.Resource.List(ctx, metav1.ListOptions{})
				require.Error(t, err)
				require.Equal(t, metav1.StatusReasonForbidden, helper.AsStatusError(err).Status().Reason)
			})
		}
	})

	t.Run("authz allows a non-grafana-admin via the fixed coordination role", func(t *testing.T) {
		// OrgB's admin is an org admin but NOT a Grafana server admin. Fine-grained
		// RBAC still grants it access: the coordination reader/writer fixed roles are
		// granted to org Admins — so access is not limited to Grafana admins.
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.OrgB.Admin, GVR: leaseGVR})
		created, err := client.Resource.Create(ctx, lease("rbac-role", "x_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "rbac-role", created.GetName())
		require.NoError(t, client.Resource.Delete(ctx, "rbac-role", metav1.DeleteOptions{}))
	})

	t.Run("authz allows a service-account identity", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			ServiceAccountToken: helper.Org1.AdminServiceAccountToken,
			Namespace:           helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:                 leaseGVR,
		})
		created, err := client.Resource.Create(ctx, lease("sa-owned", "sa_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "sa-owned", created.GetName())
		require.NoError(t, client.Resource.Delete(ctx, "sa-owned", metav1.DeleteOptions{}))
	})

	t.Run("cluster-scoped GlobalLease CRUD as grafana admin", func(t *testing.T) {
		client := helper.Org1.Admin.ResourceClient(t, globalLeaseGVR)

		created, err := client.Create(ctx, globalLease("fleet", "pod-a_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "fleet", created.GetName())
		require.Empty(t, created.GetNamespace(), "GlobalLease is cluster-scoped")

		got, err := client.Get(ctx, "fleet", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "fleet", got.GetName())

		require.NoError(t, client.Delete(ctx, "fleet", metav1.DeleteOptions{}))
	})

	t.Run("GlobalLease is owner-scoped per service identity", func(t *testing.T) {
		saA := clusterClientForToken(t, helper, helper.Org1.AdminServiceAccountToken)
		saB := clusterClientForToken(t, helper, helper.Org1.EditorServiceAccountToken)
		adminClient := helper.Org1.Admin.ResourceClient(t, globalLeaseGVR)

		// Service A creates a GlobalLease; the server stamps its identity as owner.
		created, err := saA.Create(ctx, globalLease("owned-by-a", "a_1", "2026-08-18T12:00:00Z", 30), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = adminClient.Delete(ctx, "owned-by-a", metav1.DeleteOptions{}) })
		require.NotEmpty(t, created.GetAnnotations()[ownerAnnotation], "owner annotation must be stamped on create")
		require.NotEmpty(t, created.GetLabels()[ownerLabel], "owner label must be stamped for selection")

		// Service A sees its own lease.
		aList, err := saA.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.True(t, containsName(aList.Items, "owned-by-a"))

		// Service B does not see it, and can neither get nor delete it.
		bList, err := saB.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.False(t, containsName(bList.Items, "owned-by-a"), "a service must not list another service's leases")

		_, err = saB.Get(ctx, "owned-by-a", metav1.GetOptions{})
		require.Error(t, err, "a service must not get another service's lease")

		err = saB.Delete(ctx, "owned-by-a", metav1.DeleteOptions{})
		require.Error(t, err, "a service must not delete another service's lease")

		// A grafana admin bypasses owner scoping and sees everything.
		adminList, err := adminClient.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.True(t, containsName(adminList.Items, "owned-by-a"), "admin bypasses owner scoping")
	})
}

func containsName(items []unstructured.Unstructured, name string) bool {
	for i := range items {
		if items[i].GetName() == name {
			return true
		}
	}
	return false
}

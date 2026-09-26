package folder

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// dashboardGVR is the dashboard resource used to seed a folder's direct dashboard children;
// cascade_delete_storage.go and the CascadeDeleteController both operate against the v1 GVR
// specifically, so tests exercise deletion through that same version.
var dashboardGVR = dashv1.DashboardResourceInfo.GroupVersionResource()

// newCascadeDeleteAsyncHelper boots a test apiserver with the PoC async cascade delete mechanism
// enabled: the finalizer-stamping admission mutator (register.go's Mutate) and the
// CascadeDeleteController started via the apiserver's post-start hook (GetPostStartHooks), both
// gated behind kubernetesFolderCascadeDeleteAsync.
func newCascadeDeleteAsyncHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesFolderCascadeDeleteAsync,
		},
	})
}

// createTestFolder creates a folder via the k8s dynamic client, optionally nested under
// parentUID, and returns the created object.
func createCascadeTestFolder(t *testing.T, ctx context.Context, client *apis.K8sResourceClient, title, parentUID string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"title": title},
	}}
	obj.SetGenerateName("cascade-async-")
	obj.SetAPIVersion(gvr.GroupVersion().String())
	obj.SetKind("Folder")
	if parentUID != "" {
		accessor, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		accessor.SetFolder(parentUID)
	}
	created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return created
}

// createTestDashboard creates a dashboard as a direct child of folderUID via the k8s dynamic
// client.
func createCascadeTestDashboard(t *testing.T, ctx context.Context, dashClient *apis.K8sResourceClient, title, folderUID string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"title":         title,
			"schemaVersion": 41,
		},
	}}
	obj.SetGenerateName("cascade-async-dash-")
	obj.SetAPIVersion(dashboardGVR.GroupVersion().String())
	obj.SetKind("Dashboard")
	accessor, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	accessor.SetFolder(folderUID)
	created, err := dashClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return created
}

// TestIntegrationFolderCascadeDeleteAsyncStampsFinalizerOnCreate covers: creating a folder while
// kubernetesFolderCascadeDeleteAsync is enabled gets the cascade-delete finalizer stamped by the
// admission mutator (register.go's Mutate -> stampCascadeDeleteFinalizer).
func TestIntegrationFolderCascadeDeleteAsyncStampsFinalizerOnCreate(t *testing.T) {
	helper := newCascadeDeleteAsyncHelper(t)
	ctx := context.Background()

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	created := createCascadeTestFolder(t, ctx, client, "Cascade Async Finalizer Test", "")
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})

	require.Contains(t, created.GetFinalizers(), foldersv1.CascadeDeleteFinalizer,
		"newly created folder should be stamped with the cascade-delete finalizer")

	// Confirm it's really persisted, not just echoed back on the create response.
	fetched, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
	require.NoError(t, err)
	require.Contains(t, fetched.GetFinalizers(), foldersv1.CascadeDeleteFinalizer)
}

// TestIntegrationFolderCascadeDeleteAsyncDeletesChildrenAndCompletes covers: deleting a folder
// with a direct child folder and a direct dashboard sets deletionTimestamp (rather than being
// rejected as non-empty -- see validateOnDelete's async bypass), the CascadeDeleteController
// reconciles it, both direct children get deleted, and the parent's own cascade-delete finalizer
// is removed so the folder actually disappears end-to-end.
func TestIntegrationFolderCascadeDeleteAsyncDeletesChildrenAndCompletes(t *testing.T) {
	helper := newCascadeDeleteAsyncHelper(t)
	ctx := context.Background()

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})
	dashClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardGVR,
	})

	parent := createCascadeTestFolder(t, ctx, client, "Cascade Async Parent", "")
	child := createCascadeTestFolder(t, ctx, client, "Cascade Async Child", parent.GetName())
	dash := createCascadeTestDashboard(t, ctx, dashClient, "Cascade Async Dashboard", parent.GetName())

	require.Contains(t, parent.GetFinalizers(), foldersv1.CascadeDeleteFinalizer)
	require.Contains(t, child.GetFinalizers(), foldersv1.CascadeDeleteFinalizer)

	// The search index that listChildFolders/listDashboardsInFolder read from is eventually
	// consistent with the writes above; wait for it to catch up before deleting, so the first
	// reconcile pass sees both children rather than racing an empty index.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		children, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		found := false
		for _, item := range children.Items {
			if item.GetName() == child.GetName() {
				found = true
			}
		}
		assert.True(collect, found, "child folder should be indexed")

		_, err = dashClient.Resource.Get(context.Background(), dash.GetName(), metav1.GetOptions{})
		assert.NoError(collect, err, "dashboard should exist")
	}, 10*time.Second, 100*time.Millisecond)

	// Plain delete (no gracePeriodSeconds=0): validateOnDelete's async bypass lets this proceed
	// despite the folder being non-empty, because it already carries the cascade-delete finalizer.
	err := client.Resource.Delete(ctx, parent.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err, "delete should be accepted (sets deletionTimestamp) under async cascade delete")

	// The parent must not disappear immediately -- it has a finalizer, so this is deferred to the
	// controller.
	immediatelyAfter, err := client.Resource.Get(ctx, parent.GetName(), metav1.GetOptions{})
	require.NoError(t, err, "folder should still exist immediately after delete (finalizer pending)")
	require.NotNil(t, immediatelyAfter.GetDeletionTimestamp())

	// End-to-end: the controller should delete the direct children and, once
	// status.cascadeDelete.remaining reaches 0, remove the finalizer, letting the apiserver
	// complete the folder's own deletion.
	require.Eventually(t, func() bool {
		_, err := client.Resource.Get(context.Background(), parent.GetName(), metav1.GetOptions{})
		return apierrors.IsNotFound(err)
	}, 30*time.Second, 200*time.Millisecond, "parent folder should eventually be fully deleted")

	_, err = client.Resource.Get(ctx, child.GetName(), metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "child folder should have been deleted")

	_, err = dashClient.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "dashboard should have been deleted")
}

// TestIntegrationFolderCascadeDeleteAsyncEmptyFolderDeletesCleanly covers: a folder with no
// children at all still deletes cleanly end-to-end under the async mechanism (remaining starts
// and stays at 0, so the controller removes the finalizer on its first reconcile).
func TestIntegrationFolderCascadeDeleteAsyncEmptyFolderDeletesCleanly(t *testing.T) {
	helper := newCascadeDeleteAsyncHelper(t)
	ctx := context.Background()

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	empty := createCascadeTestFolder(t, ctx, client, "Cascade Async Empty", "")
	require.Contains(t, empty.GetFinalizers(), foldersv1.CascadeDeleteFinalizer)

	err := client.Resource.Delete(ctx, empty.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)

	require.Eventually(t, func() bool {
		_, err := client.Resource.Get(context.Background(), empty.GetName(), metav1.GetOptions{})
		return apierrors.IsNotFound(err)
	}, 15*time.Second, 100*time.Millisecond, "empty folder should delete cleanly end-to-end")
}

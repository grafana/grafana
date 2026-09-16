package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// unstructuredFolder builds a minimal unstructured Folder for the fake dynamic client, optionally
// marked for deletion and carrying finalizers.
func unstructuredFolder(namespace, name string, finalizers []string, deleting bool) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(foldersv1.FolderResourceInfo.GroupVersionKind())
	u.SetNamespace(namespace)
	u.SetName(name)
	if finalizers != nil {
		u.SetFinalizers(finalizers)
	}
	if deleting {
		now := metav1.Now()
		u.SetDeletionTimestamp(&now)
	}
	return u
}

// newCascadeDeleteController wires a CascadeDeleteController to fake dynamic clients for folders
// and dashboards, seeded with objs (folders) and dashObjs (dashboards).
func newCascadeDeleteController(searcher *fakeCascadeSearcher, objs []runtime.Object, dashObjs []runtime.Object) (*CascadeDeleteController, *dynamicfake.FakeDynamicClient, *dynamicfake.FakeDynamicClient) {
	folderGVR := foldersv1.FolderResourceInfo.GroupVersionResource()
	folderDyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{folderGVR: "FolderList"}, objs...)

	dashGVR := dashv1.DashboardResourceInfo.GroupVersionResource()
	dashDyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{dashGVR: "DashboardList"}, dashObjs...)

	dashboardClient := func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		c := dashDyn.Resource(dashGVR)
		return &c, nil
	}

	ctrl := NewCascadeDeleteController(folderDyn.Resource(folderGVR), dashboardClient, searcher)
	return ctrl, folderDyn, dashDyn
}

func TestCascadeDeleteController_Reconcile_IgnoresFolderWithoutDeletionTimestamp(t *testing.T) {
	searcher := &fakeCascadeSearcher{}
	root := unstructuredFolder("default", "root", []string{foldersv1.CascadeDeleteFinalizer}, false)
	ctrl, dyn, _ := newCascadeDeleteController(searcher, []runtime.Object{root}, nil)

	require.NoError(t, ctrl.reconcile(context.Background(), "default/root"))

	got, err := dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource()).Namespace("default").Get(context.Background(), "root", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{foldersv1.CascadeDeleteFinalizer}, got.GetFinalizers(), "finalizer must be untouched when the folder isn't being deleted")
}

func TestCascadeDeleteController_Reconcile_IgnoresFolderWithoutFinalizer(t *testing.T) {
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"child"}}}
	root := unstructuredFolder("default", "root", nil, true)
	ctrl, dyn, _ := newCascadeDeleteController(searcher, []runtime.Object{root}, nil)

	require.NoError(t, ctrl.reconcile(context.Background(), "default/root"))

	// No finalizer to remove, and no attempt to delete children on our behalf.
	_, err := dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource()).Namespace("default").Get(context.Background(), "root", metav1.GetOptions{})
	require.NoError(t, err, "folder should be untouched (still present) since it doesn't carry our finalizer")
}

func TestCascadeDeleteController_Reconcile_DeletesDirectChildrenAndTracksRemaining(t *testing.T) {
	root := unstructuredFolder("default", "root", []string{foldersv1.CascadeDeleteFinalizer}, true)
	child := unstructuredFolder("default", "child", nil, false)
	dash := &unstructured.Unstructured{}
	dash.SetGroupVersionKind(dashv1.DashboardResourceInfo.GroupVersionKind())
	dash.SetNamespace("default")
	dash.SetName("dash-1")

	searcher := &fakeCascadeSearcher{
		childrenByParent:   map[string][]string{"root": {"child"}},
		dashboardsByFolder: map[string][]string{"root": {"dash-1"}},
	}
	ctrl, folderDyn, dashDyn := newCascadeDeleteController(searcher, []runtime.Object{root, child}, []runtime.Object{dash})

	// First pass: both direct children still show up in the index, so this batch deletes them and
	// reports remaining=2 (computed before the batch ran) while the deletes were in flight.
	require.NoError(t, ctrl.reconcile(context.Background(), "default/root"))

	folderGVR := foldersv1.FolderResourceInfo.GroupVersionResource()
	dashGVR := dashv1.DashboardResourceInfo.GroupVersionResource()

	_, err := folderDyn.Resource(folderGVR).Namespace("default").Get(context.Background(), "child", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "child folder should have been deleted")

	_, err = dashDyn.Resource(dashGVR).Namespace("default").Get(context.Background(), "dash-1", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "dashboard should have been deleted")

	rootObj, err := folderDyn.Resource(folderGVR).Namespace("default").Get(context.Background(), "root", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{foldersv1.CascadeDeleteFinalizer}, rootObj.GetFinalizers(), "finalizer must still be present: there was work left when this pass started")

	state, _, err := unstructured.NestedString(rootObj.Object, "status", "cascadeDelete", "state")
	require.NoError(t, err)
	require.Equal(t, string(foldersv1.CascadeDeleteStateWorking), state)

	remaining, _, err := unstructured.NestedInt64(rootObj.Object, "status", "cascadeDelete", "remaining")
	require.NoError(t, err)
	require.Equal(t, int64(2), remaining)

	started, _, err := unstructured.NestedInt64(rootObj.Object, "status", "cascadeDelete", "started")
	require.NoError(t, err)
	require.NotZero(t, started)

	// Second pass: the search index has caught up with the deletes, so there's nothing left --
	// the finalizer should be removed so the apiserver can finish deleting the folder.
	searcher.childrenByParent = nil
	searcher.dashboardsByFolder = nil
	require.NoError(t, ctrl.reconcile(context.Background(), "default/root"))

	rootObj, err = folderDyn.Resource(folderGVR).Namespace("default").Get(context.Background(), "root", metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, rootObj.GetFinalizers(), "finalizer must be removed once there are no children left")

	state, _, err = unstructured.NestedString(rootObj.Object, "status", "cascadeDelete", "state")
	require.NoError(t, err)
	require.Equal(t, string(foldersv1.CascadeDeleteStateSuccess), state)

	finished, _, err := unstructured.NestedInt64(rootObj.Object, "status", "cascadeDelete", "finished")
	require.NoError(t, err)
	require.NotZero(t, finished)
}

func TestCascadeDeleteController_Reconcile_MissingFolderIsNotAnError(t *testing.T) {
	ctrl, _, _ := newCascadeDeleteController(&fakeCascadeSearcher{}, nil, nil)
	require.NoError(t, ctrl.reconcile(context.Background(), "default/ghost"))
}

func TestCascadeDeleteController_Reconcile_PreservesOtherFinalizers(t *testing.T) {
	root := unstructuredFolder("default", "root", []string{"some-other-finalizer", foldersv1.CascadeDeleteFinalizer}, true)
	ctrl, folderDyn, _ := newCascadeDeleteController(&fakeCascadeSearcher{}, []runtime.Object{root}, nil)

	require.NoError(t, ctrl.reconcile(context.Background(), "default/root"))

	got, err := folderDyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource()).Namespace("default").Get(context.Background(), "root", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{"some-other-finalizer"}, got.GetFinalizers())
}

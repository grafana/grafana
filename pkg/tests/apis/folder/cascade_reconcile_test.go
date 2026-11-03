package folder

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

type cascadeEnv struct {
	t       *testing.T
	ctx     context.Context
	folders dynamic.ResourceInterface
	dashes  dynamic.ResourceInterface
	lister  cascadedelete.ChildLister
	ns      string
	r       *cascadedelete.Reconciler
}

func (e *cascadeEnv) createFolder(name, parent string) {
	e.t.Helper()
	obj := newFolderObject(folders.FolderResourceInfo.GroupVersion().String(), name)
	if parent != "" {
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: parent})
	}
	created, err := e.folders.Create(e.ctx, obj, metav1.CreateOptions{})
	require.NoError(e.t, err)
	require.Equal(e.t, []string{folders.CascadeDeleteFinalizer}, created.GetFinalizers())
}

func (e *cascadeEnv) createDashboards(parent string, names ...string) {
	e.t.Helper()
	for _, name := range names {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": dashv1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": name, "annotations": map[string]any{utils.AnnoKeyFolder: parent}},
			"spec":       map[string]any{"title": name, "schemaVersion": 41},
		}}
		_, err := e.dashes.Create(e.ctx, obj, metav1.CreateOptions{})
		require.NoError(e.t, err)
	}
}

func (e *cascadeEnv) getFolder(name string) *folders.Folder {
	e.t.Helper()
	u, err := e.folders.Get(e.ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	require.NoError(e.t, err)
	f := &folders.Folder{}
	require.NoError(e.t, runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, f))
	return f
}

func (e *cascadeEnv) dashboardExists(name string) bool {
	e.t.Helper()
	_, err := e.dashes.Get(e.ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return false
	}
	require.NoError(e.t, err)
	return true
}

// directChildren is the ground truth for a folder's direct children, read from storage rather than
// the search index.
func (e *cascadeEnv) directChildren(folderUID string) int64 {
	e.t.Helper()
	var n int64
	for _, c := range []dynamic.ResourceInterface{e.folders, e.dashes} {
		list, err := c.List(e.ctx, metav1.ListOptions{})
		require.NoError(e.t, err)
		for _, item := range list.Items {
			if item.GetAnnotations()[utils.AnnoKeyFolder] == folderUID {
				n++
			}
		}
	}
	return n
}

// waitIndexed waits until search returns want direct children of folderUID, so the cascade does not
// start against an index that has not caught up with the setup writes.
func (e *cascadeEnv) waitIndexed(folderUID string, want int) {
	e.t.Helper()
	require.Eventually(e.t, func() bool {
		var total int64
		for _, kind := range []cascadedelete.ChildKind{cascadedelete.ChildFolder, cascadedelete.ChildDashboard} {
			_, n, err := e.lister.ListChildren(e.ctx, e.ns, folderUID, kind, 0, 1)
			if err != nil {
				return false
			}
			total += n
		}
		return total == int64(want)
	}, 30*time.Second, 100*time.Millisecond, "search did not index the children of %s", folderUID)
}

func (e *cascadeEnv) forceDelete(name string) {
	e.t.Helper()
	zero := int64(0)
	require.NoError(e.t, e.folders.Delete(e.ctx, name, metav1.DeleteOptions{GracePeriodSeconds: &zero}))
	f := e.getFolder(name)
	require.NotNil(e.t, f, "a finalizer folder must stay until its cascade completes")
	require.NotNil(e.t, f.DeletionTimestamp)
}

// reconcile runs one pass on name and checks that the status it leaves behind counts the folder's
// current direct children. It reports whether the folder still exists.
func (e *cascadeEnv) reconcile(name string) bool {
	e.t.Helper()
	f := e.getFolder(name)
	if f == nil {
		return false
	}
	if f.DeletionTimestamp == nil {
		return true
	}
	// A pass that only finds already-deleted children is the index lagging, which drain retries.
	_, err := e.r.Reconcile(e.ctx, f)
	if !errors.Is(err, cascadedelete.ErrChildrenStillListed) {
		require.NoError(e.t, err)
	}

	after := e.getFolder(name)
	if after == nil {
		return false
	}
	st := after.Status.CascadeDelete
	require.NotNil(e.t, st, "folder %s", name)
	require.NotNil(e.t, st.Remaining, "folder %s", name)
	require.Equal(e.t, e.directChildren(name), *st.Remaining, "remaining for %s after a pass", name)
	return true
}

// drain reconciles names in order, standing in for the workqueue, until they are all gone. It
// retries because a pass may see search hits for children whose deletes the index has not caught up with.
func (e *cascadeEnv) drain(names ...string) {
	e.t.Helper()
	poll(e.t, func() bool {
		alive := false
		for _, name := range names {
			if e.reconcile(name) {
				alive = true
			}
		}
		return !alive
	})
}

// poll runs round on the test goroutine until it reports done, so require failures inside it stop
// the test immediately rather than surfacing as a timeout.
func poll(t *testing.T, round func() bool) {
	t.Helper()
	deadline := time.Now().Add(60 * time.Second)
	for !round() {
		if time.Now().After(deadline) {
			t.Fatal("cascade did not complete")
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// SQLite-only, so it runs once in the normal suite rather than across the database matrix.
func TestFolderCascadeReconcile(t *testing.T) {
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController},
	})
	dyn, err := dynamic.NewForConfig(helper.NewAdminRestConfig())
	require.NoError(t, err)
	orgID := helper.Org1.Admin.Identity.GetOrgID()
	ns := helper.Namespacer(orgID)
	clients := cascadedelete.NewDynamicClients(dyn)

	newEnv := func(t *testing.T, batchSize int) *cascadeEnv {
		lister := cascadedelete.NewSearchChildLister(helper.GetEnv().ResourceClient)
		return &cascadeEnv{
			t: t,
			// Search is scoped to the caller; the controller enumerates as the service identity.
			ctx:     identity.WithServiceIdentityContext(context.Background(), orgID),
			folders: dyn.Resource(folders.FolderResourceInfo.GroupVersionResource()).Namespace(ns),
			dashes:  dyn.Resource(dashv1.DashboardResourceInfo.GroupVersionResource()).Namespace(ns),
			lister:  lister,
			ns:      ns,
			r:       &cascadedelete.Reconciler{Children: lister, Deleter: clients, Folders: clients, BatchSize: batchSize},
		}
	}

	t.Run("leaf folder removes its dashboards then itself", func(t *testing.T) {
		e := newEnv(t, 2)
		e.createFolder("leaf", "")
		e.createDashboards("leaf", "leaf-d1", "leaf-d2", "leaf-d3")
		e.createFolder("leaf-keep", "")
		e.createDashboards("leaf-keep", "leaf-keep-d1")
		e.waitIndexed("leaf", 3)

		// Without force, a non-empty folder still cannot be deleted.
		require.Error(t, e.folders.Delete(e.ctx, "leaf", metav1.DeleteOptions{}))
		e.forceDelete("leaf")
		require.True(t, e.dashboardExists("leaf-d1"), "the delete itself must not cascade")

		// First pass deletes one batch; the folder stays, with progress readable through a GET.
		require.True(t, e.reconcile("leaf"))
		st := e.getFolder("leaf").Status.CascadeDelete
		require.Equal(t, folders.FolderCascadeDeleteStatusStateInProgress, st.State)
		require.Equal(t, int64(3), *st.Total)
		require.Equal(t, int64(1), *st.Remaining)
		require.NotNil(t, st.Started)

		e.drain("leaf")

		for _, d := range []string{"leaf-d1", "leaf-d2", "leaf-d3"} {
			require.False(t, e.dashboardExists(d), "dashboard %s should be gone", d)
		}
		require.NotNil(t, e.getFolder("leaf-keep"))
		require.True(t, e.dashboardExists("leaf-keep-d1"))
	})

	t.Run("nested folders resolve bottom-up with no orphaned dashboards", func(t *testing.T) {
		e := newEnv(t, 1)
		// a -> b -> c, dashboards at every level, plus an unrelated folder that must survive.
		e.createFolder("nest-a", "")
		e.createFolder("nest-b", "nest-a")
		e.createFolder("nest-c", "nest-b")
		e.createFolder("nest-keep", "")
		e.createDashboards("nest-a", "nest-a1", "nest-a2")
		e.createDashboards("nest-b", "nest-b1")
		e.createDashboards("nest-c", "nest-c1")
		e.createDashboards("nest-keep", "nest-keep1")
		e.waitIndexed("nest-a", 3)
		e.waitIndexed("nest-b", 2)
		e.waitIndexed("nest-c", 1)

		e.forceDelete("nest-a")
		require.NotNil(t, e.getFolder("nest-b"))
		require.True(t, e.dashboardExists("nest-a1"))

		// Reconciling the root first: it deletes b, but cannot finish while b's subtree exists.
		require.True(t, e.reconcile("nest-a"))
		require.NotNil(t, e.getFolder("nest-b").DeletionTimestamp)
		for range 5 {
			require.True(t, e.reconcile("nest-a"), "a must outlive its descendants")
		}

		// Drive the whole tree; every folder is checked on each pass to never leave while a
		// descendant is still present.
		poll(t, func() bool {
			for _, name := range []string{"nest-a", "nest-b", "nest-c"} {
				e.reconcile(name)
			}
			a, b, c := e.getFolder("nest-a"), e.getFolder("nest-b"), e.getFolder("nest-c")
			if b != nil || c != nil || e.dashboardExists("nest-c1") {
				require.NotNil(t, a, "a released before its subtree was gone")
			}
			if c != nil || e.dashboardExists("nest-c1") {
				require.NotNil(t, b, "b released before its subtree was gone")
			}
			return a == nil
		})

		for _, name := range []string{"nest-b", "nest-c"} {
			require.Nil(t, e.getFolder(name), "folder %s should be gone", name)
		}
		for _, d := range []string{"nest-a1", "nest-a2", "nest-b1", "nest-c1"} {
			require.False(t, e.dashboardExists(d), "dashboard %s should be gone", d)
		}
		require.NotNil(t, e.getFolder("nest-keep"))
		require.True(t, e.dashboardExists("nest-keep1"))
	})
}

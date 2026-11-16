package folder

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// faultyDeleter fails the delete of the child named by fail, to inject a failure into a running cascade.
type faultyDeleter struct {
	cascadedelete.ChildDeleter
	fail atomic.Pointer[string]
}

func (d *faultyDeleter) Delete(ctx context.Context, namespace, parentUID string, child cascadedelete.Child) (cascadedelete.DeleteOutcome, error) {
	if name := d.fail.Load(); name != nil && *name == child.Name {
		return cascadedelete.DeleteOutcomeDeleted, errors.New("injected failure")
	}
	return d.ChildDeleter.Delete(ctx, namespace, parentUID, child)
}

// recordingWriter keeps the cascade states written for each folder, in order and without repeats.
type recordingWriter struct {
	cascadedelete.FolderWriter
	mu     sync.Mutex
	states map[string][]folders.FolderCascadeDeleteStatusState
}

func (w *recordingWriter) UpdateCascadeStatus(ctx context.Context, namespace, name string, status folders.FolderCascadeDeleteStatus) error {
	err := w.FolderWriter.UpdateCascadeStatus(ctx, namespace, name, status)
	if err == nil {
		w.mu.Lock()
		defer w.mu.Unlock()
		if seen := w.states[name]; len(seen) == 0 || seen[len(seen)-1] != status.State {
			w.states[name] = append(seen, status.State)
		}
	}
	return err
}

func (w *recordingWriter) statesOf(name string) []folders.FolderCascadeDeleteStatusState {
	w.mu.Lock()
	defer w.mu.Unlock()
	return slices.Clone(w.states[name])
}

// feedEvents delivers folder changes to h the way a watch would: an add for each new folder, an update
// when its resourceVersion changes, and a delete when it is gone. The monolith serves no folder watch
// over HTTP, so the folders are listed on a short interval and diffed instead.
func feedEvents(ctx context.Context, client dynamic.ResourceInterface, h cache.ResourceEventHandler, synced chan<- struct{}) {
	last := map[string]*unstructured.Unstructured{}
	initial := true
	tick := time.NewTicker(50 * time.Millisecond)
	defer tick.Stop()
	for {
		list, err := client.List(ctx, metav1.ListOptions{})
		if err == nil {
			current := map[string]*unstructured.Unstructured{}
			for i := range list.Items {
				obj := &list.Items[i]
				current[obj.GetName()] = obj
				switch prev, ok := last[obj.GetName()]; {
				case !ok:
					h.OnAdd(obj, initial)
				case prev.GetResourceVersion() != obj.GetResourceVersion():
					h.OnUpdate(prev, obj)
				}
			}
			for name, prev := range last {
				if _, ok := current[name]; !ok {
					h.OnDelete(prev)
				}
			}
			last = current
			if initial {
				close(synced)
			}
			initial = false
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// Unlike TestFolderCascadeReconcile, which calls Reconcile by hand, this runs the real controller
// fed by folder events through its workqueue, against the real folder and dashboard apiservers.
func TestIntegrationFolderCascadeControllerEndToEnd(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	folderGVR := folders.FolderResourceInfo.GroupVersionResource()

	newEnv := func(t *testing.T) *cascadeEnv {
		return &cascadeEnv{
			t:       t,
			ctx:     identity.WithServiceIdentityContext(context.Background(), orgID),
			folders: dyn.Resource(folderGVR).Namespace(ns),
			dashes:  dyn.Resource(dashv1.DashboardResourceInfo.GroupVersionResource()).Namespace(ns),
			lister:  cascadedelete.NewSearchChildLister(helper.GetEnv().ResourceClient),
			ns:      ns,
		}
	}

	// startController runs a controller fed by folder events until the test ends, and returns the writer
	// that records the statuses it writes.
	startController := func(t *testing.T, deleter cascadedelete.ChildDeleter) *recordingWriter {
		t.Helper()
		clients := cascadedelete.NewDynamicClients(dyn)
		if deleter == nil {
			deleter = clients
		}
		writer := &recordingWriter{FolderWriter: clients, states: map[string][]folders.FolderCascadeDeleteStatusState{}}
		r := &cascadedelete.Reconciler{
			Children:  cascadedelete.NewSearchChildLister(helper.GetEnv().ResourceClient),
			Deleter:   deleter,
			Folders:   writer,
			BatchSize: 2,
		}
		ctrl := cascadedelete.NewController(clients, r, nil)

		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan struct{})
		go func() {
			defer close(done)
			ctrl.Run(ctx, 2)
		}()
		feedDone := make(chan struct{})
		synced := make(chan struct{})
		go func() {
			defer close(feedDone)
			feedEvents(ctx, dyn.Resource(folderGVR).Namespace(ns), ctrl.Handler(), synced)
		}()
		t.Cleanup(func() {
			cancel()
			<-done
			<-feedDone
		})
		// A folder already terminating when the initial list is read is only recorded, so the test
		// must not delete one before then.
		select {
		case <-synced:
		case <-time.After(30 * time.Second):
			t.Fatal("the initial folder list was not delivered")
		}
		return writer
	}

	// deleteForced asks for the delete without waiting for it, as the controller may finish at once.
	deleteForced := func(e *cascadeEnv, name string) {
		zero := int64(0)
		require.NoError(e.t, e.folders.Delete(e.ctx, name, metav1.DeleteOptions{GracePeriodSeconds: &zero}))
	}

	t.Run("a nested tree cascades bottom-up with no orphans", func(t *testing.T) {
		e := newEnv(t)
		e.createFolder("e2e-a", "")
		e.createFolder("e2e-b", "e2e-a")
		e.createFolder("e2e-c", "e2e-b")
		e.createFolder("e2e-keep", "")
		e.createDashboards("e2e-a", "e2e-a1", "e2e-a2", "e2e-a3")
		e.createDashboards("e2e-b", "e2e-b1")
		e.createDashboards("e2e-c", "e2e-c1", "e2e-c2")
		e.createDashboards("e2e-keep", "e2e-keep1")
		e.waitIndexed("e2e-a", 4)
		e.waitIndexed("e2e-b", 2)
		e.waitIndexed("e2e-c", 2)

		startController(t, nil)
		deleteForced(e, "e2e-a")

		// A folder must never be released while something below it is still there.
		poll(t, func() bool {
			a, b, c := e.getFolder("e2e-a"), e.getFolder("e2e-b"), e.getFolder("e2e-c")
			if b != nil || c != nil || e.dashboardExists("e2e-c1") || e.dashboardExists("e2e-c2") {
				require.NotNil(t, a, "a released before its subtree was gone")
			}
			if c != nil || e.dashboardExists("e2e-c1") || e.dashboardExists("e2e-c2") {
				require.NotNil(t, b, "b released before its subtree was gone")
			}
			return a == nil
		})

		for _, name := range []string{"e2e-b", "e2e-c"} {
			require.Nil(t, e.getFolder(name), "folder %s should be gone", name)
		}
		for _, d := range []string{"e2e-a1", "e2e-a2", "e2e-a3", "e2e-b1", "e2e-c1", "e2e-c2"} {
			require.False(t, e.dashboardExists(d), "dashboard %s should be gone", d)
		}
		require.NotNil(t, e.getFolder("e2e-keep"))
		require.True(t, e.dashboardExists("e2e-keep1"))
	})

	t.Run("progress is reported through status and ends Completed", func(t *testing.T) {
		e := newEnv(t)
		e.createFolder("e2e-progress", "")
		e.createDashboards("e2e-progress", "e2e-progress1", "e2e-progress2", "e2e-progress3", "e2e-progress4", "e2e-progress5")
		e.waitIndexed("e2e-progress", 5)

		writer := startController(t, nil)
		deleteForced(e, "e2e-progress")
		poll(t, func() bool { return e.getFolder("e2e-progress") == nil })

		// Completed is written just before the finalizer is removed, after which the folder is gone, so
		// the writes are recorded rather than read back.
		require.Equal(t, []folders.FolderCascadeDeleteStatusState{
			folders.FolderCascadeDeleteStatusStateInProgress,
			folders.FolderCascadeDeleteStatusStateCompleted,
		}, writer.statesOf("e2e-progress"))
	})

	t.Run("a failed delete is reported through status and recovers once it stops failing", func(t *testing.T) {
		e := newEnv(t)
		e.createFolder("e2e-fail", "")
		e.createDashboards("e2e-fail", "e2e-fail-ok1", "e2e-fail-bad", "e2e-fail-ok2")
		e.waitIndexed("e2e-fail", 3)

		deleter := &faultyDeleter{ChildDeleter: cascadedelete.NewDynamicClients(dyn)}
		bad := "e2e-fail-bad"
		deleter.fail.Store(&bad)
		startController(t, deleter)
		deleteForced(e, "e2e-fail")

		// The folder stays, its status says what failed, and the children that could be deleted are gone.
		require.Eventually(t, func() bool {
			f := e.getFolder("e2e-fail")
			if f == nil || f.Status.CascadeDelete == nil {
				return false
			}
			st := f.Status.CascadeDelete
			return st.State == folders.FolderCascadeDeleteStatusStateFailed &&
				len(st.Errors) == 1 && strings.Contains(st.Errors[0], bad) && strings.Contains(st.Errors[0], "injected failure") &&
				st.Remaining != nil && *st.Remaining == 1
		}, 30*time.Second, 50*time.Millisecond, "the failure was not reported in status.cascadeDelete")
		require.False(t, e.dashboardExists("e2e-fail-ok1"))
		require.False(t, e.dashboardExists("e2e-fail-ok2"))
		require.True(t, e.dashboardExists(bad))

		// The controller retries with backoff on its own; no new event is needed to finish.
		deleter.fail.Store(nil)
		poll(t, func() bool { return e.getFolder("e2e-fail") == nil })
		require.False(t, e.dashboardExists(bad))
	})
}

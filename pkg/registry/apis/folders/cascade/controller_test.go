package cascade

import (
	"context"
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// startController runs a controller against m inside the current synctest bubble, with m delivering
// folder events to it as the informer would. The returned stop must be called before the bubble ends.
func startController(t *testing.T, m *memStore, batch int) (*Controller, func()) {
	t.Helper()
	c := NewController(m, newTestReconciler(m, batch), nil)
	m.mu.Lock()
	m.handler = c.Handler()
	m.mu.Unlock()
	return c, run(c)
}

func run(c *Controller) func() {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.Run(ctx, 1)
	}()
	return func() {
		cancel()
		<-done
	}
}

func folderObj(name string) *foldersv1.Folder {
	return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name}}
}

func TestController_LargeFolderCompletesOverSeveralPasses(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", dashNames("d", 300)...)
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.Len(t, m.deleteCalls, 300)
		// 3 batches and the release, plus at most the trailing not-found from the release's own events.
		require.GreaterOrEqual(t, m.getCount("a"), 4)
		require.LessOrEqual(t, m.getCount("a"), 6)
	})
}

func TestController_NestedFoldersResolveBottomUpThroughWakeUps(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("c", "b", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("z", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "a1", "a2")
		m.addDashboards("b", "b1", "b2")
		m.addDashboards("c", "c1", "c2")
		m.addDashboards("z", "keep")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.False(t, m.exists("b"))
		require.False(t, m.exists("c"))
		require.True(t, m.exists("z"))
		require.Equal(t, map[string]string{"keep": "z"}, m.dashboards)
		// a deletes its batch, waits, and is woken once by b's release.
		require.LessOrEqual(t, m.getCount("a"), 5)
	})
}

func TestController_WaitingParentStaysIdle(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		// b's own cascade finishes, but another finalizer keeps it terminating.
		m.addFolder("b", "a", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		require.True(t, m.exists("b"))
		passes := m.getCount("a")

		time.Sleep(time.Hour)
		synctest.Wait()
		require.Equal(t, passes, m.getCount("a"), "a waiting parent must not poll")
		require.True(t, m.exists("a"))
	})
}

func TestController_SubfolderHeldByAnotherFinalizerLeavesParentToResync(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
		c, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		// Another controller releases b. Its delete event names only b, so nothing wakes a.
		m.mu.Lock()
		delete(m.folders, "b")
		m.notify("b", true)
		m.mu.Unlock()
		synctest.Wait()
		require.True(t, m.exists("a"))

		// The event source's resync delivers a again, and it finishes.
		c.Handler().OnUpdate(folderObj("a"), folderObj("a"))
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_FailureBacksOffThenRecovers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1")
		m.failDelete["d1"] = errors.New("boom")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		time.Sleep(100 * time.Millisecond)
		synctest.Wait()
		require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, m.get("a").Status.CascadeDelete.State)
		// 5ms, 10ms, 20ms, 40ms...: a handful of retries in 100ms, not a tight loop.
		require.Less(t, m.getCount("a"), 10)

		m.mu.Lock()
		delete(m.failDelete, "d1")
		m.mu.Unlock()
		time.Sleep(2 * time.Second)
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_StaleSearchHitsBackOff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		lag := &lagLister{memStore: m, stale: []Child{{ChildDashboard, "d1"}}, passes: 5}
		r := newTestReconciler(m, 100)
		r.Children = lag
		c := NewController(m, r, nil)
		m.handler = c.Handler()
		stop := run(c)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		require.Positive(t, lag.remaining(), "stale passes must back off, not run back to back")
		time.Sleep(time.Second)
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.Zero(t, lag.remaining())
		// The first status write's event skips the backoff once, so bound rather than pin the count.
		require.Less(t, m.getCount("a"), 10)
	})
}

// lagLister lists stale children for the first passes calls, like a search index that has not
// caught up with deletes yet.
type lagLister struct {
	*memStore
	mu     sync.Mutex
	stale  []Child
	passes int
}

func (l *lagLister) DirectChildren(ctx context.Context, ns, folderUID string) ([]Child, error) {
	children, err := l.memStore.DirectChildren(ctx, ns, folderUID)
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.passes > 0 {
		l.passes--
		children = append(children, l.stale...)
	}
	return children, err
}

func (l *lagLister) remaining() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.passes
}

func TestController_MissingFolderIsDropped(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		c, stop := startController(t, m, 100)
		defer stop()

		c.Handler().OnAdd(folderObj("ghost"), false)
		synctest.Wait()
		require.Equal(t, 1, m.getCount("ghost"))

		time.Sleep(time.Hour)
		synctest.Wait()
		require.Equal(t, 1, m.getCount("ghost"))
	})
}

func TestController_TombstoneIsEnqueued(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		c, stop := startController(t, m, 100)
		defer stop()

		c.Handler().OnDelete(cache.DeletedFinalStateUnknown{Key: testNamespace + "/a", Obj: folderObj("a")})
		synctest.Wait()
		require.Equal(t, 1, m.getCount("a"))
	})
}

func TestController_WakesNonTerminatingParentHarmlessly(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("p", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "p", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("b", "b1")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("b")
		synctest.Wait()

		require.False(t, m.exists("b"))
		require.Equal(t, 1, m.getCount("p"), "b's release wakes p once")
		p := m.get("p")
		require.NotNil(t, p)
		require.Nil(t, p.Status.CascadeDelete)
	})
}

func TestController_RootFolderReleaseEnqueuesNothing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		m.mu.Lock()
		defer m.mu.Unlock()
		require.Equal(t, []string{"a"}, sortedKeys(m.gets))
		require.Zero(t, m.gets[""])
	})
}

func TestController_TwoControllersShareStore(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("c", "b", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("z", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", dashNames("a", 30)...)
		m.addDashboards("b", dashNames("b", 30)...)
		m.addDashboards("c", dashNames("c", 30)...)
		m.addDashboards("z", "keep")
		c1 := NewController(m, newTestReconciler(m, 10), nil)
		c2 := NewController(m, newTestReconciler(m, 10), nil)
		m.handler = fanout{c1.Handler(), c2.Handler()}
		stop1, stop2 := run(c1), run(c2)
		defer stop1()
		defer stop2()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.False(t, m.exists("b"))
		require.False(t, m.exists("c"))
		require.True(t, m.exists("z"))
		require.Equal(t, map[string]string{"keep": "z"}, m.dashboards)
	})
}

// fanout delivers every event to all handlers, as a plain watch does for every replica.
type fanout []cache.ResourceEventHandler

func (f fanout) OnAdd(obj any, initial bool) {
	for _, h := range f {
		h.OnAdd(obj, initial)
	}
}

func (f fanout) OnUpdate(oldObj, newObj any) {
	for _, h := range f {
		h.OnUpdate(oldObj, newObj)
	}
}

func (f fanout) OnDelete(obj any) {
	for _, h := range f {
		h.OnDelete(obj)
	}
}

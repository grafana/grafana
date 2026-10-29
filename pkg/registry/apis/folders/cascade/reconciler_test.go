package cascade

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

func dashNames(prefix string, n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("%s-%03d", prefix, i)
	}
	return out
}

func TestReconcile_IgnoresFoldersOutsideTheCascade(t *testing.T) {
	t.Run("not terminating", func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1")

		res, err := reconcileOnce(t, newTestReconciler(m, 10), m, "a")
		require.NoError(t, err)
		require.False(t, res.Requeue)
		require.Empty(t, m.deleteCalls)
		require.Zero(t, m.statusWrites)
	})
	t.Run("terminating without our finalizer", func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", otherFinalizer)
		m.addDashboards("a", "d1")
		m.userDelete("a")

		res, err := reconcileOnce(t, newTestReconciler(m, 10), m, "a")
		require.NoError(t, err)
		require.False(t, res.Requeue)
		require.Empty(t, m.deleteCalls)
		require.Zero(t, m.statusWrites)
		require.Contains(t, m.folders, "a")
	})
}

func TestReconcile_LeafFolderDeletesDashboardsThenItself(t *testing.T) {
	synctest.Test(t, testLeafFolderDeletesDashboardsThenItself)
}

func testLeafFolderDeletesDashboardsThenItself(t *testing.T) {
	start := time.Now().UnixMilli()
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1", "d2", "d3")
	m.addDashboards("other", "keep")
	m.userDelete("a")
	r := newTestReconciler(m, 10)

	res, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.True(t, res.Requeue)
	require.ElementsMatch(t, []string{"d1", "d2", "d3"}, m.deleteCalls)
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateInProgress, st.State)
	require.Equal(t, int64(3), *st.Total)
	require.Equal(t, int64(0), *st.Remaining)
	require.Equal(t, start, *st.Started)
	require.Nil(t, st.Finished)

	res, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.False(t, res.Requeue)
	require.NotContains(t, m.folders, "a")
	require.Equal(t, map[string]string{"keep": "other"}, m.dashboards)
}

func TestReconcile_EmptyFolderCompletesOnFirstPass(t *testing.T) {
	synctest.Test(t, testEmptyFolderCompletesOnFirstPass)
}

func testEmptyFolderCompletesOnFirstPass(t *testing.T) {
	start := time.Now().UnixMilli()
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.userDelete("a")
	var written foldersv1.FolderCascadeDeleteStatus
	r := newTestReconciler(m, 10)
	r.Folders = &statusSpy{memStore: m, last: &written}

	res, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.False(t, res.Requeue)
	require.NotContains(t, m.folders, "a")
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateCompleted, written.State)
	require.Equal(t, int64(0), *written.Remaining)
	require.Equal(t, start, *written.Started)
	require.Equal(t, start, *written.Finished)
}

type statusSpy struct {
	*memStore
	last *foldersv1.FolderCascadeDeleteStatus
}

func (s *statusSpy) UpdateCascadeStatus(ctx context.Context, ns, name string, st foldersv1.FolderCascadeDeleteStatus) error {
	*s.last = st
	return s.memStore.UpdateCascadeStatus(ctx, ns, name, st)
}

func TestReconcile_NestedFoldersResolveBottomUp(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("c", "b", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("b2", "a", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", dashNames("a", 5)...)
	m.addDashboards("b", dashNames("b", 5)...)
	m.addDashboards("c", dashNames("c", 5)...)
	m.addDashboards("unrelated", "keep")
	m.userDelete("a")
	r := newTestReconciler(m, 3)

	// A parent cannot finish while a descendant exists.
	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.True(t, m.folders["b"].terminating)
	require.Contains(t, m.folders, "a")

	drain(t, r, m)

	require.Empty(t, m.folders)
	require.Equal(t, map[string]string{"keep": "unrelated"}, m.dashboards)
}

func TestReconcile_LegacySubfolderWithoutFinalizerIsDeletedOutright(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("legacy", "a")
	m.userDelete("a")

	drain(t, newTestReconciler(m, 10), m)
	require.Empty(t, m.folders)
}

func TestReconcile_LegacyNonEmptySubfolderFailsTheParent(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("legacy", "a")
	m.addDashboards("legacy", "inside")
	m.addDashboards("a", "d1")
	m.userDelete("a")

	res, err := reconcileOnce(t, newTestReconciler(m, 10), m, "a")
	require.ErrorContains(t, err, "not empty")
	require.True(t, res.Requeue)
	require.Equal(t, []string{"d1"}, m.deleteCalls)
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, st.State)
	require.Equal(t, []string{"folders/legacy: folder is not empty"}, st.Errors)
	require.Equal(t, int64(1), *st.Remaining)
	require.Contains(t, m.folders, "legacy")
	require.Equal(t, "legacy", m.dashboards["inside"])
}

func TestReconcile_LegacyEmptySubfolderCountsAsGoneImmediately(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("legacy", "a")
	m.userDelete("a")

	_, err := reconcileOnce(t, newTestReconciler(m, 10), m, "a")
	require.NoError(t, err)
	require.Equal(t, int64(0), *m.folders["a"].status.Remaining)
}

func TestReconcile_StaleHitForAMovedChildIsNotDeleted(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("b", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1")
	m.userDelete("a")
	r := newTestReconciler(m, 10)
	// The index still lists d1 and a subfolder under a after both moved to b.
	r.Children = staleLister{memStore: m, extra: map[string][]Child{"a": {{ChildDashboard, "moved-dash"}, {ChildFolder, "moved-folder"}}}}
	m.addDashboards("b", "moved-dash")
	m.addFolder("moved-folder", "b", foldersv1.CascadeDeleteFinalizer)

	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, []string{"d1"}, m.deleteCalls)
	require.Equal(t, "b", m.dashboards["moved-dash"])
	require.False(t, m.folders["moved-folder"].terminating)
	require.Equal(t, int64(0), *m.folders["a"].status.Remaining)
}

// staleLister adds search hits that the store no longer has under that folder.
type staleLister struct {
	*memStore
	extra map[string][]Child
}

func (s staleLister) ListChildren(_ context.Context, _, folderUID string, kind ChildKind, offset, limit int64) ([]Child, int64, error) {
	all := s.childrenOf(folderUID, kind)
	for _, c := range s.extra[folderUID] {
		if c.Kind == kind {
			all = append(all, c)
		}
	}
	return pageOf(all, offset, limit), int64(len(all)), nil
}

func TestReconcile_RemainingTracksDirectChildrenEachPass(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", dashNames("a", 5)...)
	m.addDashboards("b", dashNames("b", 4)...) // grandchildren must not be counted on a
	m.userDelete("a")
	r := newTestReconciler(m, 2)

	// Pass 1: 6 direct children; deletes b (still terminating) and one dashboard.
	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	st := m.folders["a"].status
	require.Equal(t, int64(6), *st.Total)
	require.Equal(t, int64(5), *st.Remaining)

	// Children appearing mid-cascade show up in the next count. Pass 2 lists 7 children, so a Total
	// recomputed per pass would read 7.
	m.addDashboards("a", "late1", "late2")
	_, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	st = m.folders["a"].status
	require.Equal(t, int64(6), *st.Total)
	require.Equal(t, int64(5), *st.Remaining) // b, a-003, a-004, late1, late2
}

func TestReconcile_StartedStaysFixedAndFinishedMarksCompletion(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		start := time.Now()
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1", "d2")
		m.userDelete("a")
		var written foldersv1.FolderCascadeDeleteStatus
		r := newTestReconciler(m, 1)
		r.Folders = &statusSpy{memStore: m, last: &written}

		for range 2 {
			_, err := reconcileOnce(t, r, m, "a")
			require.NoError(t, err)
			require.Equal(t, start.UnixMilli(), *written.Started, "started is set once")
			require.Nil(t, written.Finished)
			time.Sleep(time.Minute)
		}

		_, err := reconcileOnce(t, r, m, "a")
		require.NoError(t, err)
		require.NotContains(t, m.folders, "a")
		require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateCompleted, written.State)
		require.Equal(t, start.UnixMilli(), *written.Started)
		require.Equal(t, start.Add(2*time.Minute).UnixMilli(), *written.Finished)
	})
}

func TestReconcile_FinishedIsKeptWhenReleaseIsRetried(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		start := time.Now().UnixMilli()
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.userDelete("a")
		r := newTestReconciler(m, 10)
		failing := &failingRelease{memStore: m}
		r.Folders = failing

		_, err := reconcileOnce(t, r, m, "a")
		require.ErrorContains(t, err, "conflict")
		require.Equal(t, start, *m.folders["a"].status.Finished)
		writes := m.statusWrites

		time.Sleep(time.Minute)
		_, err = reconcileOnce(t, r, m, "a")
		require.Error(t, err)
		require.Equal(t, start, *m.folders["a"].status.Finished)
		require.Equal(t, writes, m.statusWrites, "an unchanged completed status is not rewritten")

		failing.ok = true
		_, err = reconcileOnce(t, r, m, "a")
		require.NoError(t, err)
		require.NotContains(t, m.folders, "a")
	})
}

type failingRelease struct {
	*memStore
	ok bool
}

func (f *failingRelease) RemoveFinalizer(ctx context.Context, ns, name string, finalizers []string) error {
	if !f.ok {
		return errors.New("conflict")
	}
	return f.memStore.RemoveFinalizer(ctx, ns, name, finalizers)
}

func TestReconcile_BatchLimitsDeletesPerPass(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", dashNames("d", 250)...)
	m.userDelete("a")
	r := newTestReconciler(m, 100)

	passes := 0
	for {
		before := len(m.deleteCalls)
		res, err := reconcileOnce(t, r, m, "a")
		require.NoError(t, err)
		passes++
		require.LessOrEqual(t, len(m.deleteCalls)-before, 100)
		if !res.Requeue {
			break
		}
	}
	require.Equal(t, 4, passes) // 100 + 100 + 50, then release
	require.NotContains(t, m.folders, "a")
}

func TestReconcile_ReadsOnlyABatchPerPass(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", dashNames("d", 1000)...)
	m.userDelete("a")
	r := newTestReconciler(m, 100)

	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, 100, m.listedRows, "one batch-sized page, not the whole folder")
	st := m.folders["a"].status
	require.Equal(t, int64(1000), *st.Total)
	require.Equal(t, int64(900), *st.Remaining)
}

func TestReconcile_PagesPastTerminatingSubfolders(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	for _, n := range dashNames("f", 5) {
		m.addFolder(n, "a", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards(n, n+"-dash") // keeps each subfolder terminating
	}
	m.addDashboards("a", "z1")
	m.userDelete("a")
	r := newTestReconciler(m, 2)

	// More terminating subfolders than fit in one page: later passes page past them.
	for range 3 {
		_, err := reconcileOnce(t, r, m, "a")
		require.NoError(t, err)
	}
	require.Equal(t, []string{"f-000", "f-001", "f-002", "f-003", "f-004", "z1"}, m.deleteCalls)
	require.Equal(t, int64(5), *m.folders["a"].status.Remaining)
}

func TestReconcile_DefaultBatchSize(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", dashNames("d", DefaultBatchSize+1)...)
	m.userDelete("a")

	_, err := reconcileOnce(t, newTestReconciler(m, 0), m, "a")
	require.NoError(t, err)
	require.Len(t, m.deleteCalls, DefaultBatchSize)
}

func TestReconcile_TerminatingSubfoldersDoNotConsumeTheBatch(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	for _, n := range []string{"f1", "f2", "f3"} {
		m.addFolder(n, "a", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards(n, n+"-dash") // keeps each subfolder terminating
	}
	m.addDashboards("a", "z1", "z2")
	m.userDelete("a")
	r := newTestReconciler(m, 3)

	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, []string{"f1", "f2", "f3"}, m.deleteCalls)

	// The subfolders are still terminating; the next pass must reach the dashboards behind them.
	_, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, []string{"f1", "f2", "f3", "z1", "z2"}, m.deleteCalls)
	require.Equal(t, int64(3), *m.folders["a"].status.Remaining)
}

func TestReconcile_FailedChildDoesNotStopTheBatch(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1", "d2", "d3")
	m.failDelete["d2"] = errors.New("boom")
	m.userDelete("a")
	r := newTestReconciler(m, 10)

	res, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "boom")
	require.True(t, res.Requeue)
	require.ElementsMatch(t, []string{"d1", "d3"}, m.deleteCalls)
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, st.State)
	require.Equal(t, []string{"dashboards/d2: boom"}, st.Errors)
	require.Equal(t, int64(1), *st.Remaining)

	// Still failing: the folder stays put.
	_, err = reconcileOnce(t, r, m, "a")
	require.Error(t, err)
	require.Contains(t, m.folders, "a")

	// Once the child can be deleted, the cascade recovers and finishes.
	delete(m.failDelete, "d2")
	res, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.True(t, res.Requeue)
	st = m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateInProgress, st.State)
	require.Empty(t, st.Errors)

	_, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.NotContains(t, m.folders, "a")
}

func TestReconcile_ErrorsAreCapped(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	for _, n := range dashNames("d", 15) {
		m.addDashboards("a", n)
		m.failDelete[n] = errors.New("boom")
	}
	m.userDelete("a")

	_, err := reconcileOnce(t, newTestReconciler(m, 100), m, "a")
	require.Error(t, err)
	require.Len(t, m.folders["a"].status.Errors, maxStatusErrors)
}

func TestReconcile_ListErrorIsReported(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.userDelete("a")
	r := newTestReconciler(m, 10)
	r.Children = failingLister{err: errors.New("search unavailable")}

	res, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "search unavailable")
	require.True(t, res.Requeue)
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, st.State)
	require.Equal(t, []string{"list folders: search unavailable"}, st.Errors)
}

type failingLister struct{ err error }

func (f failingLister) ListChildren(context.Context, string, string, ChildKind, int64, int64) ([]Child, int64, error) {
	return nil, 0, f.err
}

func TestReconcile_UnchangedStatusIsNotRewritten(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("b", "stuck")
	m.failDelete["stuck"] = errors.New("boom")
	m.userDelete("a")
	r := newTestReconciler(m, 10)

	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	writes := m.statusWrites

	// a is only waiting on terminating b: nothing changed, so no write (and no watch event).
	_, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, writes, m.statusWrites)
}

func TestReconcile_KeepsOtherFinalizers(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1")
	m.userDelete("a")

	drain(t, newTestReconciler(m, 10), m)
	require.Contains(t, m.folders, "a", "another finalizer still holds the folder")
	require.Equal(t, []string{otherFinalizer}, m.folders["a"].finalizers)
	require.Empty(t, m.dashboards)
}

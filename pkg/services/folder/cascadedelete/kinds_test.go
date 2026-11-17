package cascadedelete

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// A var, not a const, so the exhaustive linter does not treat it as a ChildKind to switch on.
var kindTagged = ChildKind("tagged")

func newRuleReconciler(m *memStore, batch int) *Reconciler {
	r := newTestReconciler(m, batch)
	r.Handlers = append(r.Handlers, KindHandler{ChildAlertRule, m, m})
	return r
}

func TestReconcile_KindsAreOptIn(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addRules("a", "r1")
	m.userDelete("a")

	res, err := reconcileOnce(t, newTestReconciler(m, 10), m, "a")
	require.NoError(t, err)
	require.Equal(t, Result{Released: true}, res)
	require.Equal(t, map[string]string{"r1": "a"}, m.rules, "rules are left alone unless the reconciler lists their kind")
}

func TestReconcile_ARuleSetIsDeletedAfterDashboardsAsOneChild(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1", "d2")
	m.addRules("a", "r1", "r2", "r3")
	m.addRules("other", "keep")
	m.userDelete("a")
	r := newRuleReconciler(m, 2)

	res, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.True(t, res.Requeue)
	require.Equal(t, []string{"d1", "d2"}, m.deleteCalls, "the batch is spent on dashboards before the rules")
	st := m.folders["a"].status
	require.Equal(t, int64(3), *st.Total, "two dashboards and the folder's rule set")
	require.Equal(t, int64(1), *st.Remaining)

	res, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.True(t, res.Requeue)
	require.Equal(t, []string{"d1", "d2", "rules/a"}, m.deleteCalls, "all rules go in a single delete")
	require.Equal(t, map[string]string{"keep": "other"}, m.rules)
	require.Contains(t, m.folders, "a", "the folder is released only by a pass that finds nothing left")

	res, err = reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	require.Equal(t, Result{Released: true}, res)
	require.NotContains(t, m.folders, "a")
}

func TestReconcile_FailedRuleSetKeepsTheFolderUntilItSucceeds(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addRules("a", "r1", "r2")
	m.failDelete["a"] = errors.New("boom")
	m.userDelete("a")
	r := newRuleReconciler(m, 10)

	_, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "boom")
	require.Len(t, m.rules, 2)
	require.Contains(t, m.folders, "a")
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, st.State)
	require.Equal(t, []string{"alertrules/a: boom"}, st.Errors)

	delete(m.failDelete, "a")
	drain(t, r, m)
	require.NotContains(t, m.folders, "a")
	require.Empty(t, m.rules)
}

type failingRuleLister struct{ err error }

func (f failingRuleLister) ListChildren(context.Context, string, string, ChildKind, int64, int64) ([]Child, int64, error) {
	return nil, 0, f.err
}

func TestReconcile_UnlistableRulesAreRecordedWithoutBlockingOtherKinds(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1", "d2")
	m.userDelete("a")
	r := newTestReconciler(m, 10)
	r.Handlers = append(r.Handlers, KindHandler{ChildAlertRule, failingRuleLister{errors.New("rules db down")}, m})

	res, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "rules db down")
	require.True(t, res.Requeue)
	require.Empty(t, m.dashboards, "dashboards are deleted although rules cannot be listed")
	st := m.folders["a"].status
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, st.State)
	require.Equal(t, []string{"list alertrules: rules db down"}, st.Errors)
}

func TestReconcile_FolderIsKeptWhileRulesCannotBeListed(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addRules("a", "r1")
	m.userDelete("a")
	r := newTestReconciler(m, 10)
	r.Handlers = append(r.Handlers, KindHandler{ChildAlertRule, failingRuleLister{errors.New("rules db down")}, m})

	res, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "rules db down")
	require.False(t, res.Released, "nothing else is left, but the unlisted rules may be")
	require.Contains(t, m.folders, "a")
	require.Nil(t, m.folders["a"].status.Total, "the totals are partial, so none is recorded")

	r.Handlers[2].Lister = m
	drain(t, r, m)
	require.NotContains(t, m.folders, "a")
	require.Empty(t, m.rules)
}

type tagLister string

func (l tagLister) ListChildren(_ context.Context, _, _ string, kind ChildKind, _, _ int64) ([]Child, int64, error) {
	return []Child{{Kind: kind, Name: string(l)}}, 1, nil
}

type tagDeleter struct{ calls *[]string }

func (d tagDeleter) Delete(_ context.Context, _, _ string, c Child) (DeleteOutcome, error) {
	*d.calls = append(*d.calls, string(c.Kind))
	return DeleteOutcomeDeleted, nil
}

func TestNewDefaultController_AppendsExtraHandlersAfterTheDefaults(t *testing.T) {
	kinds := func(c *Controller) (ks []ChildKind) {
		for _, h := range c.reconciler.Handlers {
			ks = append(ks, h.Kind)
		}
		return ks
	}
	defaults := NewDefaultController(nil, nil)
	t.Cleanup(defaults.ShutDown)
	require.Equal(t, []ChildKind{ChildFolder, ChildDashboard}, kinds(defaults))
	extended := NewDefaultController(nil, nil, KindHandler{Kind: kindTagged})
	t.Cleanup(extended.ShutDown)
	require.Equal(t, []ChildKind{ChildFolder, ChildDashboard, kindTagged}, kinds(extended))
}

func TestReconcile_NoHandlersKeepsTheFolder(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1")
	m.userDelete("a")
	r := newTestReconciler(m, 10)
	r.Handlers = nil

	res, err := reconcileOnce(t, r, m, "a")
	require.ErrorContains(t, err, "no child handlers")
	require.False(t, res.Released)
	require.Contains(t, m.folders, "a")
	require.Equal(t, map[string]string{"d1": "a"}, m.dashboards)
}

func TestReconcile_EachKindUsesItsOwnHandler(t *testing.T) {
	m := newMemStore()
	m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
	m.addDashboards("a", "d1")
	m.userDelete("a")
	var dash, tagged []string
	r := newTestReconciler(m, 10)
	r.Handlers = []KindHandler{
		{ChildDashboard, m, tagDeleter{&dash}},
		{kindTagged, tagLister("a"), tagDeleter{&tagged}},
	}

	_, err := reconcileOnce(t, r, m, "a")
	require.NoError(t, err)
	st := m.folders["a"].status
	require.Equal(t, int64(2), *st.Total, "the extra kind counts toward the total")
	require.Equal(t, int64(0), *st.Remaining)
	require.Equal(t, []string{"dashboards"}, dash)
	require.Equal(t, []string{"tagged"}, tagged)
}

package cascadedelete

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// A var, not a const, so the exhaustive linter does not treat it as a ChildKind to switch on.
var kindTagged = ChildKind("tagged")

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

func TestNewDefaultControllerWithOptions_PreservesHandlersAndRecovery(t *testing.T) {
	pending := NewPendingClient(nil)
	c := NewDefaultControllerWithOptions(nil, nil, []ControllerOption{WithPendingRecovery(pending)}, KindHandler{Kind: kindTagged})
	t.Cleanup(c.ShutDown)

	require.Same(t, pending, c.pending)
	kinds := make([]ChildKind, 0, len(c.reconciler.Handlers))
	for _, h := range c.reconciler.Handlers {
		kinds = append(kinds, h.Kind)
	}
	require.Equal(t, []ChildKind{ChildFolder, ChildDashboard, kindTagged}, kinds)
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

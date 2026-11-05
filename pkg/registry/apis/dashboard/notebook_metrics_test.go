package dashboard

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

type notebookMetricsHarness struct {
	t        *testing.T
	registry *prometheus.Registry
	metrics  *notebookMetrics
	builder  *DashboardsAPIBuilder
}

func newNotebookMetricsHarness(t *testing.T) *notebookMetricsHarness {
	t.Helper()
	registry := prometheus.NewRegistry()
	metrics := newNotebookMetrics(registry)
	return &notebookMetricsHarness{
		t:        t,
		registry: registry,
		metrics:  metrics,
		builder:  &DashboardsAPIBuilder{notebookMetrics: metrics},
	}
}

func (h *notebookMetricsHarness) create(nb *dashv2beta1.Notebook) {
	h.t.Helper()
	require.NoError(h.t, h.builder.Mutate(context.Background(), notebookAttributes(admission.Create, nb, &metav1.CreateOptions{}), nil))
}

func (h *notebookMetricsHarness) update(nb, stored *dashv2beta1.Notebook) {
	h.t.Helper()
	attrs := notebookAttributesWithOld(admission.Update, nb, stored, &metav1.UpdateOptions{})
	require.NoError(h.t, h.builder.Mutate(context.Background(), attrs, nil))
}

func (h *notebookMetricsHarness) migrated() float64 {
	return testutil.ToFloat64(h.metrics.notebooksMigrated)
}

func TestNotebookMetrics(t *testing.T) {
	t.Run("the counter exists at zero before anything is written", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)

		// Dashboards and alerts query this name, so a rename here is a breaking change.
		families, err := h.registry.Gather()
		require.NoError(t, err)
		require.Len(t, families, 1)
		require.Equal(t, "grafana_notebook_legacy_notebooks_migrated_total", families[0].GetName())
		require.Zero(t, h.migrated())
	})

	t.Run("a created notebook is not a migration", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)

		h.create(notebookWithCells(layoutCell("a", ""), layoutCell("b", "")))

		require.Zero(t, h.migrated())
	})

	t.Run("the first write to a notebook that predates ids counts one migration", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)
		stored := notebookWithCells(layoutCell("a", ""), layoutCell("b", ""))

		h.update(notebookWithCells(layoutCell("a", ""), layoutCell("b", "")), stored)

		require.Equal(t, 1.0, h.migrated())
	})

	t.Run("a notebook with only some cells missing ids still counts as one migration", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", ""))

		h.update(notebookWithCells(layoutCell("a", ""), layoutCell("b", "")), stored)

		require.Equal(t, 1.0, h.migrated())
	})

	t.Run("a notebook counts once, not on every write after it has ids", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)

		h.update(notebookWithCells(layoutCell("a", ""), layoutCell("b", "")), notebookWithCells(layoutCell("a", ""), layoutCell("b", "")))
		// What the notebook looks like after that write: every cell has an id.
		migrated := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))
		h.update(notebookWithCells(layoutCell("a", ""), layoutCell("b", ""), layoutCell("c", "")), migrated)

		require.Equal(t, 1.0, h.migrated())
	})

	// An older client sends no ids on every save. Counting the ids it gets back would make every one
	// of its saves look like a migration.
	t.Run("a write that only inherits ids is not a migration", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))

		h.update(notebookWithCells(layoutCell("a", ""), layoutCell("b", "")), stored)

		require.Zero(t, h.migrated())
	})

	t.Run("a write that removes every cell of a notebook that predates ids migrates nothing", func(t *testing.T) {
		h := newNotebookMetricsHarness(t)
		stored := notebookWithCells(layoutCell("a", ""))

		h.update(notebookWithCells(), stored)

		require.Zero(t, h.migrated())
	})

	t.Run("a nil metrics value counts nothing and does not panic", func(t *testing.T) {
		var metrics *notebookMetrics

		require.NotPanics(t, func() { metrics.observeMigration(3, true) })
	})
}

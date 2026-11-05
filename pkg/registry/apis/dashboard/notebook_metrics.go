package dashboard

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"k8s.io/apiserver/pkg/admission"
)

// notebookMetrics lets an operator follow notebooks gaining cell ids: how many ids the server hands
// out, and how many notebooks that predate ids have been through a write since.
//
// Both are counted when the write is admitted, before storage commits it, so a write rejected
// afterwards (a failed validation, a conflict) is still counted, and a notebook it was about to
// migrate is counted again by the write that follows.
//
// A nil *notebookMetrics counts nothing, which is what a builder constructed without a registry gets.
type notebookMetrics struct {
	cellIDsAssigned   *prometheus.CounterVec
	notebooksMigrated prometheus.Counter
}

func newNotebookMetrics(reg prometheus.Registerer) *notebookMetrics {
	factory := promauto.With(reg)

	m := &notebookMetrics{
		cellIDsAssigned: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_notebook_cell_ids_assigned_total",
			Help: "Cell ids the server generated for Notebook layout items, by operation. An id inherited from the stored notebook is not counted.",
		}, []string{"operation"}),
		notebooksMigrated: factory.NewCounter(prometheus.CounterOpts{
			Name: "grafana_notebook_legacy_notebooks_migrated_total",
			Help: "Writes that gave cell ids to a stored Notebook whose cells had none. A notebook counts once, when its first write after ids were introduced is admitted.",
		}),
	}

	// So a rate over either exists from the first scrape rather than from the first increment.
	m.cellIDsAssigned.WithLabelValues(notebookOperationCreate)
	m.cellIDsAssigned.WithLabelValues(notebookOperationUpdate)

	return m
}

const (
	notebookOperationCreate = "create"
	notebookOperationUpdate = "update"
)

// observeCellIDs records what one admitted write did. generated is the number of ids it minted, and
// storedWithoutIDs is whether the notebook it replaced had cells with no id.
func (m *notebookMetrics) observeCellIDs(op admission.Operation, generated int, storedWithoutIDs bool) {
	if m == nil || generated == 0 {
		return
	}

	// A fixed pair rather than the operation's own string, so the label can never take another value.
	operation := notebookOperationUpdate
	if op == admission.Create {
		operation = notebookOperationCreate
	}
	m.cellIDsAssigned.WithLabelValues(operation).Add(float64(generated))

	if storedWithoutIDs {
		m.notebooksMigrated.Inc()
	}
}

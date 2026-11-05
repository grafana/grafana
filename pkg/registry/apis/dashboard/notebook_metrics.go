package dashboard

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// notebookMetrics lets an operator follow notebooks that predate cell ids being given ids.
//
// It is counted when the write is admitted, before storage commits it, so a write rejected afterwards
// (a failed validation, a conflict) is still counted, and the write that follows counts the notebook
// again.
//
// A nil *notebookMetrics counts nothing, which is what a builder constructed without a registry gets.
type notebookMetrics struct {
	notebooksMigrated prometheus.Counter
}

func newNotebookMetrics(reg prometheus.Registerer) *notebookMetrics {
	return &notebookMetrics{
		notebooksMigrated: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "grafana_notebook_legacy_notebooks_migrated_total",
			Help: "Writes that gave cell ids to a stored Notebook whose cells had none. A notebook counts once, when its first write after ids were introduced is admitted.",
		}),
	}
}

// observeMigration records one admitted write. generated is the number of ids it minted, and
// storedWithoutIDs is whether the notebook it replaced had cells with no id. Only a write that did both
// is a migration: a write that merely inherits ids, or adds a cell to a notebook that already has them,
// is not.
func (m *notebookMetrics) observeMigration(generated int, storedWithoutIDs bool) {
	if m == nil || generated == 0 || !storedWithoutIDs {
		return
	}
	m.notebooksMigrated.Inc()
}

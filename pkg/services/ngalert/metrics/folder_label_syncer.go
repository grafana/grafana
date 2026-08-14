package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Reasons recorded on the folder label syncer failure counters. Bounded so the label stays low
// cardinality, and chosen so each value points at a different subsystem to investigate.
const (
	// Backfill.
	ReasonFetchOrgs           = "fetch_orgs"
	ReasonListFoldersWithRule = "list_folders_with_rules"
	ReasonListLabeledFolders  = "list_labeled_folders"

	// Reconcile.
	ReasonCountRules  = "count_rules"
	ReasonGetFolder   = "get_folder"
	ReasonPatchFolder = "patch_folder"
)

// FolderLabelSyncer tracks failures of the job that keeps the has-rules label on folders in step
// with the rules they hold.
type FolderLabelSyncer struct {
	// BackfillFailures counts orgs the startup backfill could not process. The backfill is the only
	// backstop for drift, so a non-zero value means some folders may carry a stale label until the
	// next restart.
	BackfillFailures *prometheus.CounterVec
	// BackfillSuccesses counts orgs the startup backfill processed without error, whether or not it
	// found anything to queue. It is the denominator for BackfillFailures, and on its own answers
	// "did the backfill run at all" — which a failure counter cannot, since zero failures and never
	// having run look identical.
	BackfillSuccesses prometheus.Counter
	// ReconcileFailures counts folders whose label could not be brought in line after a rule change.
	ReconcileFailures *prometheus.CounterVec
}

func NewFolderLabelSyncerMetrics(r prometheus.Registerer) *FolderLabelSyncer {
	return &FolderLabelSyncer{
		BackfillFailures: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "folder_label_syncer_backfill_failures_total",
			Help:      "The total number of failures encountered by the folder label backfill, by reason.",
		}, []string{"reason"}),
		BackfillSuccesses: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "folder_label_syncer_backfill_successes_total",
			Help:      "The total number of orgs the folder label backfill processed without error.",
		}),
		ReconcileFailures: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "folder_label_syncer_reconcile_failures_total",
			Help:      "The total number of failures reconciling a folder's has-rules label after a rule change, by reason.",
		}, []string{"reason"}),
	}
}

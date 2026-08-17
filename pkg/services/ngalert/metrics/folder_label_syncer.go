package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Sync types recorded on the folder label syncer counters, distinguishing the startup/periodic pass
// over every folder from the event-driven pass over a single changed folder.
const (
	SyncTypeFull    = "full"
	SyncTypePartial = "partial"
)

// FolderLabelSyncer tracks the job that keeps the has-rules label on folders in step with the rules
// they hold, split by sync_type into the startup/periodic full sync and the event-driven partial sync.
type FolderLabelSyncer struct {
	// Total counts syncs that completed without error, whether or not they found anything to change.
	// It is the denominator for Failures, and on its own answers "did the syncer run at all" — which a
	// failure counter cannot, since zero failures and never having run look identical. For a full sync
	// this is per org; for a partial sync, per folder.
	Total *prometheus.CounterVec
	// Failures counts syncs that could not complete. A non-zero full sync failure means some folders
	// may carry a stale label until the next pass; a non-zero partial sync failure means a folder
	// touched by a rule change wasn't relabeled and is waiting on the next full sync to repair it.
	Failures *prometheus.CounterVec
}

func NewFolderLabelSyncerMetrics(r prometheus.Registerer) *FolderLabelSyncer {
	return &FolderLabelSyncer{
		Total: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "folder_label_syncer_total",
			Help:      "The total number of folder label syncs completed without error, by sync_type.",
		}, []string{"sync_type"}),
		Failures: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "folder_label_syncer_failures_total",
			Help:      "The total number of failures encountered by the folder label syncer, by sync_type.",
		}, []string{"sync_type"}),
	}
}

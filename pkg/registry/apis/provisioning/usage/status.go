package usage

import (
	"fmt"
	"strings"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RepositoryUsageStatus is a point-in-time snapshot of a single provisioning
// repository's usage. The repository controller logs one of these on every
// reconcile as the structured log line "repository usage status".
//
// # Why this log line matters
//
// It is the only source of a *point-in-time, per-repository* view of the Git
// Sync fleet, and downstream investigations and dashboards depend on it. Treat
// it as load-bearing: it must keep being emitted on every reconcile, with stable
// field names.
//
// The two obvious alternatives were considered and deliberately rejected:
//
//   - The aggregated usage stats collected by MetricCollector in this package are
//     phoned home infrequently and flattened across the whole instance. They can
//     tell you totals, but not "what did repository X look like at time T", nor
//     "when did this repository become unhealthy, stop syncing, or change size".
//
//   - Prometheus metrics were avoided because a per-repository, per-namespace
//     series set is unbounded in the multi-tenant operator (thousands of
//     namespaces × repositories × resource kinds) and would blow up cardinality.
//     Aggregated metrics that drop the namespace/name labels lose exactly the
//     per-repository detail we need for debugging a specific tenant.
//
// Logs carry that high-cardinality, per-object detail for free, and a log query
// scoped to a time window reconstructs the snapshot for any moment — which is
// precisely what operators need when debugging one tenant's repository. All of
// the snapshot's values come from the reconciled object already in hand, so
// emitting it costs no extra reads.
//
// Repository identity — namespace, name, type, and connection — is carried by the
// reconcile logger and so is not repeated in LogValues; queries can still group
// by those fields.
type RepositoryUsageStatus struct {
	// Type is the repository backend type (github, git, local, ...).
	Type string
	// SyncEnabled reports whether scheduled sync is turned on.
	SyncEnabled bool
	// SyncTarget is where the repository syncs to (instance, folder, folderless).
	SyncTarget string
	// Healthy is the repository's last observed health.
	Healthy bool
	// SyncState is the state of the last sync job (pending/running/success/error).
	SyncState string
	// LastSyncFinished is when the last sync finished, in epoch milliseconds.
	LastSyncFinished int64
	// ManagedResourceCount is the total number of resources managed by the
	// repository as of its last sync.
	ManagedResourceCount int64
	// ManagedResources is the per-kind breakdown, e.g.
	// "dashboard.grafana.app/dashboards=7 folder.grafana.app/folders=3".
	ManagedResources string
}

// RepositoryUsageStatusFromRepository builds a snapshot from the reconciled
// object. It performs no I/O — every field is read from the object in hand.
func RepositoryUsageStatusFromRepository(repo *provisioning.Repository) RepositoryUsageStatus {
	var total int64
	var b strings.Builder
	for i, s := range repo.Status.Stats {
		total += s.Count
		if i > 0 {
			b.WriteByte(' ')
		}
		fmt.Fprintf(&b, "%s/%s=%d", s.Group, s.Resource, s.Count)
	}

	return RepositoryUsageStatus{
		Type:                 string(repo.Spec.Type),
		SyncEnabled:          repo.Spec.Sync.Enabled,
		SyncTarget:           string(repo.Spec.Sync.Target),
		Healthy:              repo.Status.Health.Healthy,
		SyncState:            string(repo.Status.Sync.State),
		LastSyncFinished:     repo.Status.Sync.Finished,
		ManagedResourceCount: total,
		ManagedResources:     b.String(),
	}
}

// LogValues returns the snapshot as structured key/value pairs for the
// "repository usage status" log line. These field names are part of the log's
// contract: renaming them breaks downstream queries and dashboards, so change
// them only deliberately.
func (s RepositoryUsageStatus) LogValues() []any {
	return []any{
		"target", s.SyncTarget,
		"syncEnabled", s.SyncEnabled,
		"healthy", s.Healthy,
		"syncState", s.SyncState,
		"lastSyncFinished", s.LastSyncFinished,
		"managedResourceCount", s.ManagedResourceCount,
		"managedResources", s.ManagedResources,
	}
}

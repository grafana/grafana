package usage

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Log messages emitted per reconcile for the repository usage snapshot. They are
// part of the log's contract -- dashboards and queries match on them -- so change
// them only deliberately.
const (
	// LogMessageUsageStatus is the repository-level snapshot: one line per
	// repository per reconcile.
	LogMessageUsageStatus = "repository usage status"
	// LogMessageManagedResources is the per-kind managed-resource breakdown: one
	// line per (repository, group, resource) per reconcile.
	LogMessageManagedResources = "repository managed resources"
)

// RepositoryUsageStatus is a point-in-time snapshot of a single provisioning
// repository's usage. The repository controller logs it on every reconcile, so a
// per-repository view of the Git Sync fleet can be reconstructed for any moment
// from logs.
//
// # Why a log line, and why this shape
//
// This is the only source of a *point-in-time, per-repository* view of the fleet,
// and it is load-bearing: dashboards and investigations depend on it being emitted
// every reconcile with stable field and message names.
//
// The obvious alternatives were rejected:
//
//   - The aggregated usage stats collected by MetricCollector in this package are
//     phoned home infrequently and flattened across the whole instance. They give
//     totals, not "what did repository X look like at time T".
//
//   - Prometheus metrics were avoided because a per-repository, per-namespace
//     series set is unbounded in the multi-tenant operator (thousands of
//     namespaces × repositories × resource kinds). Aggregated metrics that drop
//     those labels lose exactly the per-repository detail we need.
//
// # Built for Loki dashboards
//
// The snapshot is emitted as two logfmt-friendly shapes so breakdowns can be
// plotted directly:
//
//   - One repository-level line (LogMessageUsageStatus) whose numeric fields
//     (booleans rendered as 1/0, counts, timestamps) can be `unwrap`ped.
//   - One line per managed-resource kind (LogMessageManagedResources) carrying
//     `group` and `resource` as field *values* and an unwrappable `count` -- so a
//     per-kind breakdown is `sum by (group, resource) (... | unwrap count)` rather
//     than a regex over a packed string. (A single line can't do this: group/
//     resource names like "dashboard.grafana.app/dashboards" are not valid logfmt
//     keys.)
//
// Repository identity -- namespace, name, type, connection -- is carried by the
// reconcile logger on both lines, so queries can still group by those without the
// snapshot repeating them.
//
// Example Loki queries (with the reconcile logger's fields):
//
//	# Managed resources by kind across the fleet
//	sum by (group, resource) (
//	  last_over_time({...} | logfmt | msg=`repository managed resources` | unwrap count [$__interval])
//	)
//	# Repositories by type
//	count by (repositoryType) (
//	  count by (repository) (
//	    count_over_time({...} | logfmt | msg=`repository usage status` [$__interval])
//	  )
//	)
//	# Unhealthy repositories
//	count by (repository) (count_over_time({...} | logfmt | msg=`repository usage status` | healthy=`0` [$__interval]))
type RepositoryUsageStatus struct {
	// Type is the repository backend type (github, git, local, ...).
	Type string
	// SyncEnabled reports whether scheduled sync is turned on.
	SyncEnabled bool
	// SyncTarget is where the repository syncs to (instance, folder, folderless).
	SyncTarget string
	// Healthy is the repository's last observed health.
	Healthy bool
	// SyncState is the state of the last sync job (pending/working/success/error).
	SyncState string
	// LastSyncFinished is when the last sync finished, in epoch milliseconds.
	LastSyncFinished int64
	// ManagedResourceCount is the total number of resources managed by the
	// repository as of its last sync.
	ManagedResourceCount int64
	// ManagedResources is the per-kind breakdown, one entry per group/resource.
	ManagedResources []provisioning.ResourceCount
}

// RepositoryUsageStatusFromRepository builds a snapshot from the reconciled
// object. It performs no I/O — every field is read from the object in hand.
func RepositoryUsageStatusFromRepository(repo *provisioning.Repository) RepositoryUsageStatus {
	var total int64
	for _, s := range repo.Status.Stats {
		total += s.Count
	}

	return RepositoryUsageStatus{
		Type:                 string(repo.Spec.Type),
		SyncEnabled:          repo.Spec.Sync.Enabled,
		SyncTarget:           string(repo.Spec.Sync.Target),
		Healthy:              repo.Status.Health.Healthy,
		SyncState:            string(repo.Status.Sync.State),
		LastSyncFinished:     repo.Status.Sync.Finished,
		ManagedResourceCount: total,
		ManagedResources:     repo.Status.Stats,
	}
}

// LogValues returns the repository-level snapshot as structured key/value pairs
// for the LogMessageUsageStatus line. Booleans are rendered as 1/0 so they can be
// `unwrap`ped in Loki. Repository identity (incl. repositoryType) is carried by
// the reconcile logger, so it is not repeated here. These field names are part of
// the log's contract.
func (s RepositoryUsageStatus) LogValues() []any {
	return []any{
		"target", s.SyncTarget,
		"syncEnabled", boolToInt(s.SyncEnabled),
		"healthy", boolToInt(s.Healthy),
		"syncState", s.SyncState,
		"lastSyncFinished", s.LastSyncFinished,
		"managedResourceCount", s.ManagedResourceCount,
	}
}

// ManagedResourceLogValues returns one key/value slice per managed-resource kind,
// each meant for its own LogMessageManagedResources line. `count` is unwrappable
// and `group`/`resource` are field values to group by. Empty when nothing is
// managed.
func (s RepositoryUsageStatus) ManagedResourceLogValues() [][]any {
	out := make([][]any, 0, len(s.ManagedResources))
	for _, rc := range s.ManagedResources {
		out = append(out, []any{
			"group", rc.Group,
			"resource", rc.Resource,
			"count", rc.Count,
		})
	}
	return out
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

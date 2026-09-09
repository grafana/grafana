package usage

import (
	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/api/meta"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
//   - One repository-level line ("repository usage status") whose numeric fields
//     (booleans rendered as 1/0, counts, timestamps) can be `unwrap`ped.
//   - One line per managed-resource kind ("repository managed resources") carrying
//     `group` and `resource` as field *values* and an unwrappable `count` -- so a
//     per-kind breakdown is `sum by (group, resource) (... | unwrap count)` rather
//     than a regex over a packed string. (A single line can't do this: group/
//     resource names like "dashboard.grafana.app/dashboards" are not valid logfmt
//     keys.)
//
// A kind is logged only while the repository still manages at least one of it; a
// kind whose count falls to zero simply stops being emitted (there is no
// tombstone, as that would need per-repository state we intentionally avoid). So
// `last_over_time(... | unwrap count)` keeps a removed kind's last positive value
// until it ages out of the query window: bound the range to a small multiple of
// the reconcile/resync interval for a "current" snapshot, and use the
// repository-level managedResourceCount for exact per-repository totals.
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
//	# Repositories by why they are not ready (auth, invalid spec, ...)
//	count by (readyReason) (count by (repository, readyReason) (
//	  count_over_time({...} | logfmt | msg=`repository usage status` [$__range])))
type RepositoryUsageStatus struct {
	// Type is the repository backend type (github, git, local, ...).
	Type string
	// CreatedAt is when the repository resource was created, in epoch milliseconds.
	CreatedAt int64
	// UpdatedAt is when the repository resource was last updated
	// (grafana.app/updatedTimestamp), in epoch milliseconds; 0 if never set.
	UpdatedAt int64
	// AuthMethod is how the repository authenticates: "none" (local), "connection"
	// (delegated to a referenced Connection -- whose own type carries the concrete
	// auth mechanism), or "token" (a token/PAT stored on the repository).
	AuthMethod string
	// ReadOnly reports that no write workflows are enabled (Spec.Workflows empty),
	// so the repository is pull-only.
	ReadOnly bool
	// SyncEnabled reports whether scheduled sync is turned on.
	SyncEnabled bool
	// SyncTarget is where the repository syncs to (instance, folder, folderless).
	SyncTarget string
	// Healthy is the repository's last observed health.
	Healthy bool
	// ReadyReason classifies the repository's Ready condition. It is the single
	// field that says *why* a repository is (not) usable: "Available" when ready,
	// or a failure class otherwise -- notably "AuthenticationFailed" (bad/expired
	// credentials or insufficient permissions) and "InvalidSpec" (a configuration
	// error the user must fix), plus "ServiceUnavailable", "RateLimited", and the
	// quota reasons. Empty before the first health check sets a Ready condition.
	ReadyReason string
	// SyncState is the state of the last sync job (pending/working/success/error).
	SyncState string
	// LastSyncFinishedAt is when the last sync finished, in epoch milliseconds.
	LastSyncFinishedAt int64
	// ManagedResourceCount is the total number of resources managed by the
	// repository as of its last sync.
	ManagedResourceCount int64
	// ManagedResources is the per-kind breakdown, one entry per group/resource.
	ManagedResources []provisioning.ResourceCount
}

// LogRepositoryUsageStatus emits the repository usage-status snapshot on logger:
// the repository-level "repository usage status" line plus one "repository
// managed resources" line per managed-resource kind. Repository identity is
// expected to already be on logger (the reconcile logger carries namespace,
// repository, repositoryType, connection). Call it once per reconcile.
func LogRepositoryUsageStatus(logger logging.Logger, repo *provisioning.Repository) {
	status := RepositoryUsageStatusFromRepository(repo)
	logger.Info("repository usage status", status.LogValues()...)
	for _, kv := range status.ManagedResourceLogValues() {
		logger.Info("repository managed resources", kv...)
	}
}

// RepositoryUsageStatusFromRepository builds a snapshot from the reconciled
// object. It performs no I/O — every field is read from the object in hand.
func RepositoryUsageStatusFromRepository(repo *provisioning.Repository) RepositoryUsageStatus {
	var total int64
	for _, s := range repo.Status.Stats {
		total += s.Count
	}

	var readyReason string
	if ready := meta.FindStatusCondition(repo.Status.Conditions, provisioning.ConditionTypeReady); ready != nil {
		readyReason = ready.Reason
	}

	var createdAt int64
	if ts := repo.GetCreationTimestamp(); !ts.IsZero() {
		createdAt = ts.UnixMilli()
	}
	// UpdatedAt is best-effort: it comes from the grafana.app/updatedTimestamp
	// annotation, which may be absent or malformed; either way we log 0 rather
	// than fail the snapshot.
	var updatedAt int64
	if acc, err := utils.MetaAccessor(repo); err == nil {
		if ts, err := acc.GetUpdatedTimestamp(); err == nil && ts != nil {
			updatedAt = ts.UnixMilli()
		}
	}

	return RepositoryUsageStatus{
		Type:                 string(repo.Spec.Type),
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
		AuthMethod:           repositoryAuthMethod(repo),
		ReadOnly:             len(repo.Spec.Workflows) == 0,
		SyncEnabled:          repo.Spec.Sync.Enabled,
		SyncTarget:           string(repo.Spec.Sync.Target),
		Healthy:              repo.Status.Health.Healthy,
		ReadyReason:          readyReason,
		SyncState:            string(repo.Status.Sync.State),
		LastSyncFinishedAt:   repo.Status.Sync.Finished,
		ManagedResourceCount: total,
		ManagedResources:     repo.Status.Stats,
	}
}

// repositoryAuthMethod classifies how a repository authenticates:
//   - "none": local repositories, which have no remote to authenticate against.
//   - "connection": auth is delegated to a referenced Connection, whose own type
//     distinguishes GitHub App from the OAuth providers.
//   - "token": a token/PAT is stored on the repository.
//   - "anonymous": a remote repository with neither a token nor a connection --
//     a public, read-only repo, which the validator permits.
func repositoryAuthMethod(repo *provisioning.Repository) string {
	switch {
	case repo.Spec.Type == provisioning.LocalRepositoryType:
		return "none"
	case repo.Spec.Connection != nil && repo.Spec.Connection.Name != "":
		return "connection"
	case !repo.Secure.Token.IsZero():
		return "token"
	default:
		return "anonymous"
	}
}

// LogValues returns the repository-level snapshot as structured key/value pairs
// for the "repository usage status" line. Booleans are rendered as 1/0 so they can be
// `unwrap`ped in Loki. Repository identity (incl. repositoryType) is carried by
// the reconcile logger, so it is not repeated here. These field names are part of
// the log's contract.
func (s RepositoryUsageStatus) LogValues() []any {
	return []any{
		"createdAt", s.CreatedAt,
		"updatedAt", s.UpdatedAt,
		"authMethod", s.AuthMethod,
		"readOnly", boolToInt(s.ReadOnly),
		"target", s.SyncTarget,
		"syncEnabled", boolToInt(s.SyncEnabled),
		"healthy", boolToInt(s.Healthy),
		"readyReason", s.ReadyReason,
		"syncState", s.SyncState,
		"lastSyncFinishedAt", s.LastSyncFinishedAt,
		"managedResourceCount", s.ManagedResourceCount,
	}
}

// ManagedResourceLogValues returns one key/value slice per managed-resource kind,
// each meant for its own "repository managed resources" line. `count` is unwrappable
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

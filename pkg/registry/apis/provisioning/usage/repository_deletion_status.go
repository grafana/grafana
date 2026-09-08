package usage

import (
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RepositoryDeletionStatus is a point-in-time snapshot of a repository that is
// being deleted. The repository controller logs it on every delete reconcile, so
// a stuck deletion can be identified per-repository from logs.
//
// # Why a log line
//
// This exists for the same reason as RepositoryUsageStatus: it is the only
// *point-in-time, per-repository* view of the delete path. The delete-path
// Prometheus metrics (grafana_provisioning_repository_deletion_*) are
// deliberately aggregate — no namespace/name label — to stay bounded in the
// multi-tenant operator, so they can tell you the fleet has a stuck deletion but
// not *which* repository. This line closes that gap: repository identity
// (namespace, name, type, connection) is carried by the reconcile logger, and the
// fields below say how long it has been terminating, which finalizers are still
// attached, and whether the last delete attempt recorded an error.
//
// A stuck repository keeps re-reconciling at resync cadence, so PendingSeconds
// climbs across successive lines while the finalizers and error persist.
//
// Example Loki queries (with the reconcile logger's fields):
//
//	# Repositories terminating longer than an hour
//	count by (repository) (
//	  count_over_time({...} | logfmt | msg=`repository deletion status` | pendingSeconds > 3600 [$__interval]))
//	# Repositories whose delete recorded an error
//	count by (repository) (
//	  count_over_time({...} | logfmt | msg=`repository deletion status` | hasDeleteError=`1` [$__interval]))
type RepositoryDeletionStatus struct {
	// DeletionTimestamp is when the repository was marked for deletion, in epoch
	// milliseconds; 0 if it is not being deleted.
	DeletionTimestamp int64
	// PendingSeconds is how long the repository has been in Terminating.
	PendingSeconds int64
	// Finalizers are the finalizers still attached, which is what keeps the
	// repository from being removed. Empty means it should disappear imminently.
	Finalizers []string
	// DeleteError is the error recorded by the last delete attempt (status.deleteError),
	// empty if the last attempt did not record one.
	DeleteError string
}

// LogRepositoryDeletionStatus emits the deletion snapshot on logger as a single
// "repository deletion status" line. Repository identity is expected to already
// be on logger (the reconcile logger carries namespace, repository,
// repositoryType, connection). Call it once per delete reconcile.
func LogRepositoryDeletionStatus(logger logging.Logger, repo *provisioning.Repository) {
	logger.Info("repository deletion status", RepositoryDeletionStatusFromRepository(repo).LogValues()...)
}

// RepositoryDeletionStatusFromRepository builds a snapshot from the reconciled
// object. It performs no I/O — every field is read from the object in hand.
func RepositoryDeletionStatusFromRepository(repo *provisioning.Repository) RepositoryDeletionStatus {
	var deletionTimestamp, pendingSeconds int64
	if ts := repo.GetDeletionTimestamp(); ts != nil {
		deletionTimestamp = ts.UnixMilli()
		if age := time.Since(ts.Time); age > 0 {
			pendingSeconds = int64(age.Seconds())
		}
	}

	return RepositoryDeletionStatus{
		DeletionTimestamp: deletionTimestamp,
		PendingSeconds:    pendingSeconds,
		Finalizers:        repo.Finalizers,
		DeleteError:       repo.Status.DeleteError,
	}
}

// LogValues returns the snapshot as structured key/value pairs for the
// "repository deletion status" line. hasDeleteError is rendered as 1/0 so it can
// be `unwrap`ped/filtered in Loki. These field names are part of the log's
// contract.
func (s RepositoryDeletionStatus) LogValues() []any {
	return []any{
		"deletionTimestamp", s.DeletionTimestamp,
		"pendingSeconds", s.PendingSeconds,
		"finalizerCount", len(s.Finalizers),
		"finalizers", strings.Join(s.Finalizers, ","),
		"hasDeleteError", boolToInt(s.DeleteError != ""),
		"deleteError", s.DeleteError,
	}
}

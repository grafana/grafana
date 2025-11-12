package sync

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/jobs"
)

// SyncAbandonmentHandler handles cleanup for abandoned sync/pull jobs.
// When a sync job is abandoned, we need to update the repository's sync status to reflect the failure.
type SyncAbandonmentHandler struct {
	patcher RepositoryPatchFn
}

// Ensure SyncAbandonmentHandler implements AbandonmentHandler
var _ jobs.AbandonmentHandler = (*SyncAbandonmentHandler)(nil)

// NewSyncAbandonmentHandler creates a new handler for sync job abandonment.
func NewSyncAbandonmentHandler(patcher RepositoryPatchFn) *SyncAbandonmentHandler {
	return &SyncAbandonmentHandler{
		patcher: patcher,
	}
}

// SupportsAction returns true for pull and migrate actions (both use sync status).
func (h *SyncAbandonmentHandler) SupportsAction(action provisioning.JobAction) bool {
	return action == provisioning.JobActionPull || action == provisioning.JobActionMigrate
}

// HandleAbandonment updates the repository's sync status to error when a sync job is abandoned.
func (h *SyncAbandonmentHandler) HandleAbandonment(ctx context.Context, job *provisioning.Job) error {
	logger := logging.FromContext(ctx).With("namespace", job.GetNamespace(), "repository", job.Spec.Repository, "job", job.GetName())

	// Find the repository this job was syncing
	repo := &provisioning.Repository{}
	repo.SetNamespace(job.GetNamespace())
	repo.SetName(job.Spec.Repository)

	// Update sync status to error
	patchOps := []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/sync/state",
			"value": provisioning.JobStateError,
		},
	}

	// Only add message if not empty
	if job.Status.Message != "" {
		patchOps = append(patchOps, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/message",
			"value": []string{job.Status.Message},
		})
	}

	// Only add finished timestamp if set
	if job.Status.Finished > 0 {
		patchOps = append(patchOps, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/finished",
			"value": job.Status.Finished,
		})
	}

	if err := h.patcher(ctx, repo, patchOps...); err != nil {
		logger.Error("failed to update repository sync status for abandoned job", "error", err)
		return fmt.Errorf("update repository sync status: %w", err)
	}

	logger.Debug("updated repository sync status for abandoned job")
	return nil
}

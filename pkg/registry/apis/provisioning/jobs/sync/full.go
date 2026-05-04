package sync

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FullSync computes and applies the diff between a repository state and Grafana, honoring ordering, quotas,
// and folder metadata. It orchestrates compare, quota check, and phased application of deletions and creations.
func FullSync(
	ctx context.Context,
	repo repository.Reader,
	compare CompareFn,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	maxSyncWorkers int,
	metrics jobs.JobMetrics,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) error {
	syncStart := time.Now()
	cfg := repo.Config()

	ctx, span := tracer.Start(ctx, "provisioning.sync.full")
	defer span.End()
	defer func() {
		metrics.RecordSyncDuration(jobs.SyncTypeFull, time.Since(syncStart))
	}()

	ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.full.ensure_folder_exists")
	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := repositoryResources.EnsureFolderExists(ensureFolderCtx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			ensureFolderSpan.RecordError(err)
			ensureFolderSpan.End()

			// An unmanaged collision on the root folder is the user-facing
			// outcome of "Delete and keep resources" + reconnect with the
			// same name. Surface it as a per-resource validation warning in
			// the pull job output and stop cleanly: no children can be
			// placed under an unclaimed root, but failing the whole job
			// hides the actual cause.
			var unmanagedErr *resources.ResourceUnmanagedConflictError
			if errors.As(err, &unmanagedErr) {
				progress.Record(ctx, jobs.NewFolderResult("").
					WithName(rootFolder).
					WithAction(repository.FileActionCreated).
					WithError(err).
					Build())
				progress.SetFinalMessage(ctx, "root folder cannot be claimed by this repository")
				return nil
			}
			return tracing.Error(span, fmt.Errorf("create root folder: %w", err))
		}
	}
	ensureFolderSpan.End()

	compareCtx, compareSpan := tracer.Start(ctx, "provisioning.sync.full.compare")
	var changes []ResourceFileChange
	var missingFolderMetadata []string
	var invalidFolderMetadata []*resources.InvalidFolderMetadata
	err := instrumentedFullSyncPhase(jobs.FullSyncPhaseCompare, func() (err error) {
		changes, missingFolderMetadata, invalidFolderMetadata, err = compare(compareCtx, repo, repositoryResources, currentRef, folderMetadataEnabled)
		return
	}, metrics)
	compareSpan.End()

	if err != nil {
		return tracing.Error(span, fmt.Errorf("compare changes: %w", err))
	}

	if folderMetadataEnabled && len(missingFolderMetadata) > 0 {
		logging.FromContext(ctx).Info("missing folder metadata detected", "count", len(missingFolderMetadata))
		changeActions := make(map[string]repository.FileAction, len(changes))
		for _, c := range changes {
			changeActions[c.Path] = c.Action
		}
		for _, p := range missingFolderMetadata {
			builder := jobs.NewFolderResult(p).
				WithWarning(resources.NewMissingFolderMetadata(p))
			if action, ok := changeActions[p]; ok {
				builder = builder.WithAction(action)
			} else {
				builder = builder.WithAction(repository.FileActionIgnored)
			}
			progress.Record(ctx, builder.Build())
		}
	}

	if folderMetadataEnabled && len(invalidFolderMetadata) > 0 {
		logging.FromContext(ctx).Info("invalid folder metadata detected", "count", len(invalidFolderMetadata))
		for _, invalid := range invalidFolderMetadata {
			action := invalid.Action
			if action == "" {
				action = repository.FileActionIgnored
			}
			progress.Record(ctx, jobs.NewFolderResult(invalid.Path).
				WithAction(action).
				WithWarning(invalid).
				Build())
		}
	}

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	// Detect file renames: collapse delete+create pairs that share the same
	// content hash into a single update so K8s UIDs are preserved.
	_, renameSpan := tracer.Start(ctx, "provisioning.sync.full.detect_renames")
	changes = DetectRenames(changes)
	renameSpan.End()

	// Check quota before applying changes
	if err := checkQuotaBeforeSync(ctx, repo, changes, tracer); err != nil {
		span.SetAttributes(attribute.Bool("pre_check_quota", false))
		progress.Record(ctx, jobs.NewResourceResult().WithError(err).Build())
		progress.SetFinalMessage(ctx, "sync skipped: repository is already over quota and incoming changes do not free enough resources")

		return nil
	}
	span.SetAttributes(attribute.Bool("pre_check_quota", true))

	deps := applyDeps{
		clients:               clients,
		currentRef:            currentRef,
		repositoryResources:   repositoryResources,
		progress:              progress,
		tracer:                tracer,
		quotaTracker:          quotaTracker,
		folderMetadataEnabled: folderMetadataEnabled,
		// affected folders aren't tracked for full sync — Compare() already
		// emits orphan deletions from the source-vs-target join.
		affected: nil,
	}

	folderRenames := 0
	for _, change := range changes {
		if safepath.IsDir(change.Path) && change.FolderRenamed {
			folderRenames++
		}
	}
	if folderRenames > 0 {
		quotaTracker.AllowOverLimit(folderRenames)
	}

	return applyChanges(ctx, changes, deps, maxSyncWorkers, fullSyncPhaseRecorder(metrics))
}

// instrumentedFullSyncPhase records timing metrics around a full-sync compare
// phase. Apply phases are recorded via fullSyncPhaseRecorder threaded through
// the shared apply pipeline.
func instrumentedFullSyncPhase(phase jobs.FullSyncPhase, fn func() error, metrics jobs.JobMetrics) error {
	phaseStart := time.Now()
	err := fn()
	metrics.RecordFullSyncPhase(phase, time.Since(phaseStart))
	return err
}

// fullSyncPhaseRecorder maps the shared ApplyPhase values into the
// FullSyncPhase metric space so the unified apply pipeline keeps recording
// the same per-phase durations that full sync has always reported.
func fullSyncPhaseRecorder(metrics jobs.JobMetrics) ApplyPhaseRecorder {
	return func(p ApplyPhase, d time.Duration) {
		switch p {
		case ApplyPhaseFileDeletions:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseFileDeletions, d)
		case ApplyPhaseFolderCreations:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseFolderCreations, d)
		case ApplyPhaseFileRenames:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseFileRenames, d)
		case ApplyPhaseFolderDeletions:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseFolderDeletions, d)
		case ApplyPhaseFileCreations:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseFileCreations, d)
		case ApplyPhaseOldFolderCleanup:
			metrics.RecordFullSyncPhase(jobs.FullSyncPhaseOldFolderCleanup, d)
		}
	}
}

package sync

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// IncrementalSync converts a git diff between two refs into apply-ready
// ResourceFileChange entries (mirroring how full sync turns a tree snapshot
// into changes) and feeds them through the shared apply pipeline.
func IncrementalSync(
	ctx context.Context,
	repo repository.Versioned,
	previousRef, currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	metrics jobs.JobMetrics,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) error {
	syncStart := time.Now()
	if previousRef == currentRef {
		// Even when no commits moved we still need to surface missing folder
		// metadata if the flag is on.
		if folderMetadataEnabled {
			if err := detectMissingFolderMetadata(ctx, repo, currentRef, []repository.VersionedFileChange{}, progress, tracer); err != nil {
				return err
			}
		}
		progress.SetFinalMessage(ctx, "same commit as last time")
		return nil
	}

	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental")
	defer span.End()
	defer func() {
		metrics.RecordSyncDuration(jobs.SyncTypeIncremental, time.Since(syncStart))
	}()

	compareStart := time.Now()
	compareCtx, compareSpan := tracer.Start(ctx, "provisioning.sync.incremental.compare_files")
	diff, err := repo.CompareFiles(compareCtx, previousRef, currentRef)
	if err != nil {
		compareSpan.RecordError(err)
		compareSpan.End()
		return tracing.Error(span, fmt.Errorf("compare files error: %w", err))
	}
	compareSpan.End()
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseCompare, time.Since(compareStart))

	if len(diff) < 1 {
		progress.SetFinalMessage(ctx, "no changes detected between commits")
		return nil
	}

	convertCtx, convertSpan := tracer.Start(ctx, "provisioning.sync.incremental.convert_changes")
	converted, err := IncrementalChanges(convertCtx, repo, repositoryResources, currentRef, diff, folderMetadataEnabled)
	if err != nil {
		convertSpan.RecordError(err)
		convertSpan.End()
		return tracing.Error(span, err)
	}
	convertSpan.SetAttributes(
		attribute.Int("changes_count", len(converted.Changes)),
		attribute.Int("replaced_folders", len(converted.ReplacedFolders)),
		attribute.Int("invalid_folder_metadata", len(converted.InvalidFolderMetadata)),
	)
	convertSpan.End()

	if folderMetadataEnabled {
		logging.FromContext(ctx).Info("folder metadata diff built",
			"replacedFolders", len(converted.ReplacedFolders),
			"invalidMetadata", len(converted.InvalidFolderMetadata),
			"diffSize", len(converted.Changes),
		)
	}

	// Temporarily raise the quota limit for net-zero folder replacements so
	// TryAcquire succeeds when creating the new folder before the old one is
	// deleted in the cleanup phase.
	if len(converted.ReplacedFolders) > 0 {
		quotaTracker.AllowOverLimit(len(converted.ReplacedFolders))
	}
	progress.SetMessage(ctx, "replicating versioned changes")

	affected := newAffectedFolderCollector()
	deps := applyDeps{
		clients:               nil, // incremental does not need a ResourceClients handle
		currentRef:            currentRef,
		repositoryResources:   repositoryResources,
		progress:              progress,
		tracer:                tracer,
		quotaTracker:          quotaTracker,
		folderMetadataEnabled: folderMetadataEnabled,
		affected:              affected,
	}

	applyStart := time.Now()
	// Incremental sync historically applied changes serially; preserve that
	// by capping workers to 1 so RemoveResourceFromFile and ReplaceResourceFromFileByRef
	// (which read the previous ref) don't race.
	if err := applyChanges(ctx, converted.Changes, deps, 1, incrementalApplyPhaseRecorder(metrics, applyStart)); err != nil {
		return err
	}
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseApply, time.Since(applyStart))

	progress.SetMessage(ctx, "versioned changes replicated")

	cleanupStart := time.Now()
	foldersToDelete := findOrphanedFolders(ctx, repo, currentRef, affected.Map(), tracer)
	for _, r := range converted.ReplacedFolders {
		if progress.HasDirPathFailedCreation(r.Path) {
			progress.Record(ctx, jobs.NewFolderResult(r.Path).
				WithAction(repository.FileActionIgnored).
				WithName(r.OldUID).
				WithWarning(fmt.Errorf("old folder %s not deleted because the replacement folder at %s could not be created", r.OldUID, r.Path)).
				Build())
			continue
		}
		foldersToDelete = append(foldersToDelete, folderDeletion{Path: r.Path, UID: r.OldUID, Reason: r.Reason})
	}
	foldersToDelete = deduplicateFolderDeletions(foldersToDelete)
	deleteFolders(ctx, foldersToDelete, repositoryResources, progress, tracer)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseCleanup, time.Since(cleanupStart))

	if folderMetadataEnabled {
		recordInvalidFolderMetadataWarnings(ctx, converted.InvalidFolderMetadata, progress)
		if err := detectMissingFolderMetadata(ctx, repo, currentRef, diff, progress, tracer); err != nil {
			return err
		}
	}

	return nil
}

// incrementalApplyPhaseRecorder is a no-op recorder: incremental sync reports
// a single apply duration via IncrementalSyncPhaseApply rather than per-phase
// timings, so we ignore the per-phase callbacks from the shared engine.
func incrementalApplyPhaseRecorder(_ jobs.JobMetrics, _ time.Time) ApplyPhaseRecorder {
	return nil
}

// folderDeletion pairs a folder path with the K8s UID of the resource to
// delete. Using a slice of these (instead of a map) avoids silently dropping
// duplicate UIDs that share the same path (e.g. orphans from prior name
// changes).
type folderDeletion struct {
	Path   string
	UID    string
	Reason string // explicit reason for the deletion (e.g. ReasonFolderMetadataUpdated)
}

// deduplicateFolderDeletions removes duplicate (Path, UID) pairs from the
// deletion list. Duplicates can occur when both findOrphanedFolders and
// replaced-folder metadata cleanup produce entries for the same folder.
func deduplicateFolderDeletions(deletions []folderDeletion) []folderDeletion {
	type key struct{ path, uid string }
	seen := make(map[key]bool, len(deletions))
	result := make([]folderDeletion, 0, len(deletions))
	for _, d := range deletions {
		k := key{d.Path, d.UID}
		if seen[k] {
			continue
		}
		seen[k] = true
		result = append(result, d)
	}
	return result
}

// findOrphanedFolders checks which affected folders no longer exist in git
// and returns a list of folders to delete.
func findOrphanedFolders(
	ctx context.Context,
	repo repository.Versioned,
	currentRef string,
	affectedFolders map[string]string,
	tracer tracing.Tracer,
) []folderDeletion {
	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.find_orphaned_folders")
	defer span.End()

	readerRepo, ok := repo.(repository.Reader)
	if !ok {
		span.RecordError(fmt.Errorf("repository does not implement Reader"))
		return nil
	}

	logger := logging.FromContext(ctx)
	var orphaned []folderDeletion
	for path, folderName := range affectedFolders {
		span.SetAttributes(attribute.String("folder", folderName))

		_, err := readerRepo.Read(ctx, path, currentRef)
		if err != nil && (errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Info("orphaned folder detected", "path", path, "uid", folderName)
			span.AddEvent("folder not found in git, marking for deletion")
			orphaned = append(orphaned, folderDeletion{Path: path, UID: folderName, Reason: provisioning.ReasonFolderOrphaned})
			continue
		}
		if err != nil {
			span.RecordError(err)
			span.AddEvent("could not determine folder existence in git, skipping")
			continue
		}

		span.AddEvent("folder still exists in git, continuing")
	}

	return orphaned
}

// deleteFolders removes folder K8s objects, processing deepest paths first.
func deleteFolders(
	ctx context.Context,
	foldersToDelete []folderDeletion,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
) {
	if len(foldersToDelete) == 0 {
		return
	}

	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.delete_folders")
	defer span.End()

	safepath.SortByDepth(foldersToDelete, func(d folderDeletion) string { return d.Path }, false)

	for _, entry := range foldersToDelete {
		if progress.HasDirPathFailedCreation(entry.Path) || progress.HasDirPathFailedDeletion(entry.Path) || progress.HasChildPathFailedCreation(entry.Path) || progress.HasChildPathFailedUpdate(entry.Path) {
			progress.Record(ctx, jobs.NewFolderResult(entry.Path).
				WithAction(repository.FileActionIgnored).
				WithName(entry.UID).
				WithWarning(fmt.Errorf("folder %s was not deleted because a related operation failed", entry.UID)).
				Build())
			continue
		}

		resultBuilder := jobs.NewFolderResult(entry.Path).
			WithAction(repository.FileActionDeleted).
			WithName(entry.UID)
		if entry.Reason != "" {
			resultBuilder.WithReason(entry.Reason)
		}
		if err := repositoryResources.RemoveFolder(ctx, entry.UID); err != nil {
			span.RecordError(err)
			resultBuilder.WithError(fmt.Errorf("delete folder %s: %w", entry.UID, err))
		}
		progress.Record(ctx, resultBuilder.Build())
	}
}

// recordInvalidFolderMetadataWarnings writes collected invalid `_folder.json`
// warnings to job progress after folder cleanup has completed.
func recordInvalidFolderMetadataWarnings(ctx context.Context, invalid []*resources.InvalidFolderMetadata, progress jobs.JobProgressRecorder) {
	for _, warning := range invalid {
		action := warning.Action
		if action == "" {
			action = repository.FileActionIgnored
		}
		progress.Record(ctx, jobs.NewFolderResult(warning.Path).
			WithAction(action).
			WithWarning(warning).
			Build())
	}
}

// detectMissingFolderMetadata reads the full file tree and records warnings for folders
// that do not have a folder metadata file.
func detectMissingFolderMetadata(ctx context.Context, repo repository.Versioned, currentRef string, diff []repository.VersionedFileChange, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.detect_missing_folder_metadata")
	defer span.End()

	readerRepo, ok := repo.(repository.Reader)
	if !ok {
		span.RecordError(fmt.Errorf("repository does not implement Reader"))
		return nil
	}

	tree, err := readerRepo.ReadTree(ctx, currentRef)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("detect missing folder metadata: %w", err)
	}

	changeActions := make(map[string]repository.FileAction, len(diff))
	for _, c := range diff {
		changeActions[c.Path] = c.Action
	}

	missing := resources.FindFoldersMissingMetadata(tree)
	if len(missing) > 0 {
		logger := logging.FromContext(ctx)
		logger.Info("missing folder metadata detected", "count", len(missing))
	}
	for _, p := range missing {
		builder := jobs.NewFolderResult(p).
			WithWarning(resources.NewMissingFolderMetadata(p))
		if action, ok := changeActions[p]; ok {
			builder = builder.WithAction(action)
		} else {
			builder = builder.WithAction(repository.FileActionIgnored)
		}
		progress.Record(ctx, builder.Build())
	}

	return nil
}

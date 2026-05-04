package sync

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// Convert git changes into resource file changes
func IncrementalSync(ctx context.Context, repo repository.Versioned, previousRef, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, metrics jobs.JobMetrics, quotaTracker quotas.QuotaTracker, folderMetadataEnabled bool) error {
	syncStart := time.Now()
	if previousRef == currentRef {
		// We still need to detect missing folder metadata if the flag is enabled
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

	var replaced []replacedFolder
	var relocations map[string][]string
	var invalidFolderMetadata []*resources.InvalidFolderMetadata
	if folderMetadataEnabled {
		readerRepo, ok := repo.(repository.Reader)
		if !ok {
			return tracing.Error(span, fmt.Errorf("folder metadata incremental sync requires repository.Reader"))
		}

		target, err := repositoryResources.List(ctx)
		if err != nil {
			return tracing.Error(span, fmt.Errorf("list managed resources: %w", err))
		}

		folderMetadataIncrementalDiffBuilder := NewFolderMetadataIncrementalDiffBuilder(readerRepo)
		diff, relocations, replaced, invalidFolderMetadata, err = folderMetadataIncrementalDiffBuilder.BuildIncrementalDiff(ctx, currentRef, diff, target)
		if err != nil {
			return tracing.Error(span, fmt.Errorf("build folder metadata incremental diff: %w", err))
		}

		// Incremental sync normally starts with an empty folder tree, but folder
		// metadata handling needs the current managed path->UID state before apply:
		// - invalid `_folder.json` falls back to the existing folder at that path
		// - folders cannot overtake existing UIDs
		tree := resources.NewFolderTreeFromResourceList(target)
		repositoryResources.SetTree(tree)
	}

	// Temporarily raise the quota limit for net-zero folder replacements so
	// TryAcquire succeeds when creating the new folder before the old one is
	// deleted in the cleanup phase.
	if len(replaced) > 0 {
		quotaTracker.AllowOverLimit(len(replaced))
	}

	progress.SetTotal(ctx, len(diff))
	progress.SetMessage(ctx, "replicating versioned changes")
	applyStart := time.Now()
	affectedFolders, err := applyIncrementalChanges(ctx, diff, repositoryResources, progress, tracer, span, quotaTracker, folderMetadataEnabled, relocations)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseApply, time.Since(applyStart))
	if err != nil {
		return err
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	cleanupStart := time.Now()
	foldersToDelete := findOrphanedFolders(ctx, repo, currentRef, affectedFolders, tracer)

	for _, r := range replaced {
		if progress.HasDirPathFailedCreation(r.Path) {
			progress.Record(ctx, jobs.NewFolderResult(r.Path).
				WithAction(repository.FileActionIgnored).
				WithName(r.OldUID).
				WithWarning(fmt.Errorf("old folder %s not deleted because the replacement folder at %s could not be created", r.OldUID, r.Path)).
				Build())
			continue
		}
		foldersToDelete = append(foldersToDelete, folderDeletion{Path: r.Path, UID: r.OldUID})
	}

	foldersToDelete = deduplicateFolderDeletions(foldersToDelete)
	deleteFolders(ctx, foldersToDelete, repositoryResources, progress, tracer)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseCleanup, time.Since(cleanupStart))

	// Run after deleteFolders so its informational warnings (e.g. missing
	// _folder.json) don't interfere with HasChildPathFailedUpdate safety checks.
	if folderMetadataEnabled {
		recordInvalidFolderMetadataWarnings(ctx, invalidFolderMetadata, progress)
		if err := detectMissingFolderMetadata(ctx, repo, currentRef, diff, progress, tracer); err != nil {
			return err
		}
	}

	return nil
}

//nolint:gocyclo
func applyIncrementalChanges(ctx context.Context, diff []repository.VersionedFileChange, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, span trace.Span, quotaTracker quotas.QuotaTracker, folderMetadataEnabled bool, relocations map[string][]string) (affectedFolders map[string]string, err error) {
	// this will keep track of any folders that had resources deleted from it
	// with key-value as path:grafana uid.
	// after cleaning up all resources, we will look to see if the foldrs are
	// now empty, and if so, delete them.
	affectedFolders = make(map[string]string)

	sortChangesByActionPriority(diff)

	for _, change := range diff {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if err := progress.TooManyErrors(); err != nil {
			return nil, tracing.Error(span, err)
		}

		// Check if this resource is nested under a failed folder creation
		// This only applies to creation/update/rename operations, not deletions
		if change.Action != repository.FileActionDeleted && progress.HasDirPathFailedCreation(change.Path) {
			// Skip this resource since its parent folder failed to be created
			skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.incremental.skip_nested_resource")
			progress.Record(skipCtx, jobs.NewPathOnlyResult(change.Path).
				WithError(fmt.Errorf("resource was not processed because the parent folder could not be created")).
				AsSkipped().
				Build())
			skipSpan.End()
			continue
		}

		if err := resources.IsPathSupported(change.Path); err != nil {
			ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.incremental.ensure_folder_path_exist")
			// Maintain the safe segment for empty folders
			safeSegment := safepath.SafeSegment(change.Path)
			if !safepath.IsDir(safeSegment) {
				safeSegment = safepath.Dir(safeSegment)
			}

			if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
				folder, err := repositoryResources.EnsureFolderPathExist(ensureFolderCtx, safeSegment, change.Ref)
				if err != nil {
					ensureFolderSpan.RecordError(err)
					ensureFolderSpan.End()

					progress.Record(ensureFolderCtx, jobs.NewFolderResult(change.Path).
						WithError(err).
						WithAction(repository.FileActionIgnored).
						Build())
					continue
				}

				progress.Record(ensureFolderCtx, jobs.NewFolderResult(folder).
					WithPath(safeSegment).
					WithAction(repository.FileActionCreated).
					Build())
				ensureFolderSpan.End()
				continue
			}

			progress.Record(ensureFolderCtx, jobs.NewPathOnlyResult(change.Path).WithAction(repository.FileActionIgnored).Build())
			ensureFolderSpan.End()
			continue
		}

		resultBuilder := jobs.NewPathOnlyResult(change.Path).WithAction(change.Action)

		// Directory entries (trailing-slash paths) need special handling:
		// - Renamed directories reach RenameFolderPath below.
		// - Updated directories are emitted by planFolderMetadataChanges when a
		//   parent folder's UID changed; re-parent them via EnsureFolderPathExist.
		// - Created/deleted directory entries from cross-boundary renames are
		//   skipped since individual file-level changes handle them.
		if safepath.IsDir(change.Path) && change.Action != repository.FileActionRenamed {
			if change.Action == repository.FileActionUpdated {
				folderResultBuilder := jobs.NewFolderResult(change.Path).WithAction(change.Action)
				folderCtx, folderSpan := tracer.Start(ctx, "provisioning.sync.incremental.reparent_child_folder")
				ensureOpts := []resources.EnsurePathOption{resources.WithForceWalk()}
				if uids, ok := relocations[change.Path]; ok {
					ensureOpts = append(ensureOpts, resources.WithRelocatingUIDs(uids...))
				}
				folder, fErr := repositoryResources.EnsureFolderPathExist(folderCtx, change.Path, change.Ref, ensureOpts...)
				if fErr != nil {
					folderSpan.RecordError(fErr)
					folderResultBuilder.WithError(fmt.Errorf("re-parenting child folder at %s: %w", change.Path, fErr))
				}
				folderResultBuilder.WithName(folder)
				folderSpan.End()
				progress.Record(ctx, folderResultBuilder.Build())
			} else {
				progress.Record(ctx, resultBuilder.Build())
			}
			continue
		}

		if change.Action == repository.FileActionCreated && !quotaTracker.TryAcquire() {
			progress.Record(ctx, resultBuilder.
				WithError(quotas.NewQuotaExceededError(fmt.Errorf("resource quota exceeded, skipping creation of %s", change.Path))).
				AsSkipped().
				Build())
			continue
		}

		switch change.Action {
		case repository.FileActionCreated:
			writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.write_resource_from_file")
			name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, change.Ref)
			if err != nil {
				writeSpan.RecordError(err)
				resultBuilder.WithError(fmt.Errorf("writing resource from file %s: %w", change.Path, err))
			}
			resultBuilder.WithName(name).WithGVK(gvk)
			writeSpan.End()
		case repository.FileActionUpdated:
			if change.PreviousRef != "" {
				writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.replace_resource_from_file")
				name, gvk, err := repositoryResources.ReplaceResourceFromFileByRef(writeCtx, change.Path, change.Ref, change.PreviousRef)
				if err != nil {
					writeSpan.RecordError(err)
					resultBuilder.WithError(fmt.Errorf("replacing resource from file %s: %w", change.Path, err))
				}
				resultBuilder.WithName(name).WithGVK(gvk)
				writeSpan.End()
			} else {
				writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.write_resource_from_file")
				name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, change.Ref)
				if err != nil {
					writeSpan.RecordError(err)
					resultBuilder.WithError(fmt.Errorf("writing resource from file %s: %w", change.Path, err))
				}
				resultBuilder.WithName(name).WithGVK(gvk)
				writeSpan.End()
			}
		case repository.FileActionDeleted:
			removeCtx, removeSpan := tracer.Start(ctx, "provisioning.sync.incremental.remove_resource_from_file")
			name, folderName, gvk, err := repositoryResources.RemoveResourceFromFile(removeCtx, change.Path, change.PreviousRef)
			if err != nil {
				removeSpan.RecordError(err)
				resultBuilder.WithError(fmt.Errorf("removing resource from file %s: %w", change.Path, err))
			} else {
				quotaTracker.Release()
			}
			resultBuilder.WithName(name).WithGVK(gvk)

			if folderName != "" {
				affectedFolders[safepath.Dir(change.Path)] = folderName
			}

			removeSpan.End()
		case repository.FileActionRenamed:
			resultBuilder.WithPreviousPath(change.PreviousPath)
			if safepath.IsDir(change.Path) {
				renameFolderCtx, renameFolderSpan := tracer.Start(ctx, "provisioning.sync.incremental.rename_folder_path")
				var folderRenameOpts []resources.EnsurePathOption
				for dir := safepath.Dir(change.Path); dir != ""; dir = safepath.Dir(dir) {
					if uids, ok := relocations[dir]; ok {
						folderRenameOpts = append(folderRenameOpts, resources.WithRelocatingUIDs(uids...))
					}
				}
				oldFolderID, err := repositoryResources.RenameFolderPath(renameFolderCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref, folderRenameOpts...)
				if err != nil {
					renameFolderSpan.RecordError(err)
					resultBuilder.WithError(fmt.Errorf("renaming folder from %s to %s: %w", change.PreviousPath, change.Path, err))
				}
				if oldFolderID != "" {
					affectedFolders[change.PreviousPath] = oldFolderID
				}
				renameFolderSpan.End()
			} else {
				renameCtx, renameSpan := tracer.Start(ctx, "provisioning.sync.incremental.rename_resource_file")
				var renameOpts []resources.EnsurePathOption
				for dir := safepath.EnsureTrailingSlash(safepath.Dir(change.Path)); dir != ""; dir = safepath.Dir(dir) {
					if uids, ok := relocations[dir]; ok {
						renameOpts = append(renameOpts, resources.WithRelocatingUIDs(uids...))
					}
				}
				name, oldFolderName, gvk, err := repositoryResources.RenameResourceFile(renameCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref, renameOpts...)
				if err != nil {
					renameSpan.RecordError(err)
					resultBuilder.WithError(fmt.Errorf("renaming resource file from %s to %s: %w", change.PreviousPath, change.Path, err))
				}
				resultBuilder.WithName(name).WithGVK(gvk)

				if oldFolderName != "" {
					affectedFolders[safepath.Dir(change.PreviousPath)] = oldFolderName
				}

				renameSpan.End()
			}
		case repository.FileActionIgnored:
			// do nothing
		}
		progress.Record(ctx, resultBuilder.Build())
	}

	return affectedFolders, nil
}

// sortChangesByActionPriority reorders changes so deletions are processed before creations.
func sortChangesByActionPriority(diff []repository.VersionedFileChange) {
	slices.SortStableFunc(diff, func(a, b repository.VersionedFileChange) int {
		return actionPriority(a.Action) - actionPriority(b.Action)
	})
}

func actionPriority(action repository.FileAction) int {
	switch action {
	case repository.FileActionDeleted:
		return 0
	case repository.FileActionRenamed:
		return 1
	case repository.FileActionUpdated:
		return 2
	case repository.FileActionCreated:
		return 3
	case repository.FileActionIgnored:
		return 4
	}
	return 4
}

// folderDeletion pairs a folder path with the K8s UID of the resource to
// delete. Using a slice of these (instead of a map) avoids silently dropping
// duplicate UIDs that share the same path (e.g. orphans from prior name
// changes).
type folderDeletion struct {
	Path string
	UID  string
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

	var orphaned []folderDeletion
	for path, folderName := range affectedFolders {
		span.SetAttributes(attribute.String("folder", folderName))

		_, err := readerRepo.Read(ctx, path, currentRef)
		if err != nil && (errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			span.AddEvent("folder not found in git, marking for deletion")
			orphaned = append(orphaned, folderDeletion{Path: path, UID: folderName})
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

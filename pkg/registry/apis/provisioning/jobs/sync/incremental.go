package sync

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

type replacedFolder struct {
	Path   string
	OldUID string
}

type folderMetadataPlan struct {
	filteredDiff          []repository.VersionedFileChange
	existingFoldersByPath map[string]*provisioning.ResourceListItem
	replacedFolders       []replacedFolder
	target                *provisioning.ResourceList
}

// IncrementalSync compares two git refs, rewrites any handled folder-metadata
// diffs into synthetic folder/resource changes, applies the resulting diff, and
// then cleans up folders that became orphaned as a consequence of the sync.
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

	var replacedFolders []replacedFolderRewritten
	if folderMetadataEnabled {
		repo := repo.(repository.Reader)
		diffBuilder := NewDiffBuilder(repo, repositoryResources)
		diffCtx, diffSpan := tracer.Start(ctx, "provisioning.sync.incremental.build_diff")
		diff, replacedFolders, err = diffBuilder.BuildIncrementalDiff(diffCtx, diff)
		if err != nil {
			diffSpan.RecordError(err)
			diffSpan.End()
			return tracing.Error(span, fmt.Errorf("build incremental diff: %w", err))
		}
		defer diffSpan.End()

		for _, replaced := range replacedFolders {
			repositoryResources.RemoveFolderFromTree(replaced.OldUID)
		}
	}
	progress.SetTotal(ctx, len(diff))
	progress.SetMessage(ctx, "replicating versioned changes")

	applyStart := time.Now()
	affectedFolders, err := applyIncrementalChanges(
		ctx,
		diff,
		repositoryResources,
		progress,
		tracer,
		span,
		quotaTracker,
		folderMetadataEnabled,
	)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseApply, time.Since(applyStart))
	if err != nil {
		return err
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	if folderMetadataEnabled {
		span.AddEvent("checking if replaced folders should be deleted", trace.WithAttributes(attribute.Int("replaced_folders", len(replacedFolders))))

		removeCtx, removeSpan := tracer.Start(ctx, "provisioning.sync.incremental.remove_replaced_folders")
		for _, replaced := range replacedFolders {
            // Skip if the replacement folder failed to be created.
			if progress.HasDirPathFailedDeletion(replaced.Path) {
				skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.skip_renamed_folder_deletion")
				progress.Record(skipCtx, jobs.NewPathOnlyResult(replaced.Path).
					WithError(fmt.Errorf("old folder was not deleted because the replacement folder could not be created")).
					AsSkipped().
					Build())
				skipSpan.End()
				continue
			}

			resultBuilder := jobs.NewFolderResult(replaced.Path).
				WithAction(repository.FileActionDeleted).
				WithName(replaced.OldUID)
			if err := repositoryResources.RemoveFolder(removeCtx, replaced.OldUID); err != nil {
				removeSpan.RecordError(err)
				resultBuilder.WithError(err)
			}
			progress.Record(removeCtx, resultBuilder.Build())
		}
		removeSpan.End()

		if err := detectMissingFolderMetadata(ctx, repo, currentRef, diff, progress, tracer); err != nil {
			return err
		}
	}

	if len(affectedFolders) > 0 {
		cleanupStart := time.Now()
		span.AddEvent("checking if impacted folders should be deleted", trace.WithAttributes(attribute.Int("affected_folders", len(affectedFolders))))
		err := cleanupOrphanedFolders(ctx, repo, affectedFolders, repositoryResources, tracer, progress)
		metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseCleanup, time.Since(cleanupStart))
		if err != nil {
			return tracing.Error(span, fmt.Errorf("cleanup orphaned folders: %w", err))
		}
	}

	return nil
}

// applyIncrementalChanges executes the incremental diff after it has been
// rewritten by planning.
//
// Most entries still flow through the generic resource create/update/delete/
// rename path. Synthetic directory changes are handled explicitly so folder
// reconciliation can reuse EnsureFolderPathExist, and any replaced folder UIDs
// are deleted only after the rest of the diff has been applied.
//
//nolint:gocyclo // TODO(ferruvich): simplify this function
func applyIncrementalChanges(
	ctx context.Context,
	diff []repository.VersionedFileChange,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	span trace.Span,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) (affectedFolders map[string]string, err error) {
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

		if err := resources.IsPathSupported(change.Path); err != nil || safepath.IsDir(change.Path) {
			ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.incremental.ensure_folder_path_exist")
			// Maintain the safe segment for empty folders
			safeSegment := safepath.SafeSegment(change.Path)
			if !safepath.IsDir(safeSegment) {
				safeSegment = safepath.Dir(safeSegment)
			}

			if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
				folder, err := repositoryResources.EnsureFolderPathExist(ensureFolderCtx, safeSegment)
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

		// Created/deleted directory entries (trailing-slash paths) appear from
		// cross-boundary renames. The individual file-level changes within the
		// directory are emitted separately and already handle folder creation
		// (via EnsureFolderPathExist inside WriteResourceFromFile) and deletion
		// (via affectedFolders / orphan cleanup). Skip them to avoid routing
		// directory paths to file-processing logic. Renamed directories must
		// still reach RenameFolderPath below.
		if safepath.IsDir(change.Path) && change.Action != repository.FileActionRenamed {
			progress.Record(ctx, resultBuilder.Build())
			continue
		}

		if folderMetadataEnabled && resources.IsFolderMetadataFile(change.Path) &&
			(change.Action == repository.FileActionCreated || change.Action == repository.FileActionUpdated) {
			name, err := applyFolderMetadataUpdate(ctx, change, repositoryResources, tracer)
			if err != nil {
				resultBuilder.WithError(err)
			}
			resultBuilder.WithName(name)
			progress.Record(ctx, resultBuilder.Build())
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
		case repository.FileActionCreated, repository.FileActionUpdated:
			writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.write_resource_from_file")
			name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, change.Ref)
			if err != nil {
				writeSpan.RecordError(err)
				resultBuilder.WithError(fmt.Errorf("writing resource from file %s: %w", change.Path, err))
			}
			resultBuilder.WithName(name).WithGVK(gvk)
			writeSpan.End()
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
			if safepath.IsDir(change.Path) {
				renameFolderCtx, renameFolderSpan := tracer.Start(ctx, "provisioning.sync.incremental.rename_folder_path")
				oldFolderID, err := repositoryResources.RenameFolderPath(renameFolderCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref)
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
				name, oldFolderName, gvk, err := repositoryResources.RenameResourceFile(renameCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref)
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

// applyFolderMetadataUpdate routes _folder.json changes through EnsureFolderPathExist
// so the folder manager can create or update the folder with the correct title,
// metadata hash, and annotations.
func applyFolderMetadataUpdate(ctx context.Context, change repository.VersionedFileChange, repositoryResources resources.RepositoryResources, tracer tracing.Tracer) (string, error) {
	folderCtx, folderSpan := tracer.Start(ctx, "provisioning.sync.incremental.update_folder_metadata")
	defer folderSpan.End()

	folderDir := safepath.Dir(change.Path)
	folder, err := repositoryResources.EnsureFolderPathExist(folderCtx, folderDir)
	if err != nil {
		folderSpan.RecordError(err)
		return "", fmt.Errorf("updating folder metadata at %s: %w", folderDir, err)
	}
	return folder, nil
}

// sortChangesByActionPriority keeps the incremental apply order hierarchy-safe.
//
// Changes are grouped first by action so we still preserve the existing delete ->
// rename -> update -> create contract. Inside the same action, folder paths and
// file paths are ordered differently:
//   - deletes: files before folders, so child resources are removed before their parent
//   - everything else: folders before files, so synthetic folder replay runs before children
func sortChangesByActionPriority(diff []repository.VersionedFileChange) {
	slices.SortStableFunc(diff, func(a, b repository.VersionedFileChange) int {
		if cmp := actionPriority(a.Action) - actionPriority(b.Action); cmp != 0 {
			return cmp
		}
		return pathPriorityWithinAction(a.Action, a.Path) - pathPriorityWithinAction(b.Action, b.Path)
	})
}

// actionPriority defines the coarse incremental ordering between git actions.
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
	default:
		return 4
	}
}

// pathPriorityWithinAction breaks ties between a folder path and a file path
// that share the same action bucket.
//
// Once folder metadata changes are rewritten into synthetic directory changes,
// plain action ordering is no longer enough. We need folder creates/updates to
// run before child file work, but folder deletes to run after child file deletes.
func pathPriorityWithinAction(action repository.FileAction, path string) int {
	isDir := safepath.IsDir(path)
	switch action {
	case repository.FileActionDeleted:
		if isDir {
			return 1
		}
		return 0
	default:
		if isDir {
			return 0
		}
		return 1
	}
}

// cleanupOrphanedFolders removes target folders whose path disappeared from git
// after the incremental apply phase completed.
//
// The input map is keyed by folder path and stores the Grafana folder UID that
// should be considered for cleanup. The function skips folders whose child
// deletions failed, then checks whether the path still exists in the repository
// before removing the folder from Grafana.
func cleanupOrphanedFolders(
	ctx context.Context,
	repo repository.Versioned,
	affectedFolders map[string]string,
	repositoryResources resources.RepositoryResources,
	tracer tracing.Tracer,
	progress jobs.JobProgressRecorder,
) error {
	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.cleanup_orphaned_folders")
	defer span.End()

	readerRepo, ok := repo.(repository.Reader)
	if !ok {
		span.RecordError(fmt.Errorf("repository does not implement Reader"))
		return nil
	}

	for path, folderName := range affectedFolders {
		span.SetAttributes(attribute.String("folder", folderName))

		// Check if any resources under this folder failed to delete
		if progress.HasDirPathFailedDeletion(path) {
			span.AddEvent("skipping orphaned folder cleanup: a child resource in its path failed to be deleted")
			continue
		}

		// if we can no longer find the folder in git, then we can delete it from grafana
		_, err := readerRepo.Read(ctx, path, "")
		if err != nil && (errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			span.AddEvent("folder not found in git, removing from grafana")
			if err := repositoryResources.RemoveFolder(ctx, folderName); err != nil {
				span.RecordError(err)
			} else {
				span.AddEvent("successfully deleted")
			}
			continue
		}

		span.AddEvent("folder still exists in git, continuing")
	}

	return nil
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

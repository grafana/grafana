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
	"k8s.io/apimachinery/pkg/runtime/schema"
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
	if folderMetadataEnabled {
		if readerRepo, ok := repo.(repository.Reader); ok {
			diff, replaced, err = planFolderMetadataChanges(ctx, readerRepo, currentRef, diff, repositoryResources, tracer)
			if err != nil {
				return tracing.Error(span, fmt.Errorf("plan folder metadata changes: %w", err))
			}
		}
	}

	progress.SetTotal(ctx, len(diff))
	progress.SetMessage(ctx, "replicating versioned changes")
	applyStart := time.Now()
	affectedFolders, err := applyIncrementalChanges(ctx, diff, repositoryResources, progress, tracer, span, quotaTracker, folderMetadataEnabled)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseApply, time.Since(applyStart))
	if err != nil {
		return err
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	cleanupStart := time.Now()
	foldersToDelete := findOrphanedFolders(ctx, repo, affectedFolders, tracer)

	for _, r := range replaced {
		if progress.HasDirPathFailedCreation(r.Path) {
			progress.Record(ctx, jobs.NewFolderResult(r.Path).
				WithAction(repository.FileActionIgnored).
				WithName(r.OldUID).
				WithWarning(fmt.Errorf("old folder %s not deleted because the replacement folder at %s could not be created", r.OldUID, r.Path)).
				Build())
			continue
		}
		if foldersToDelete == nil {
			foldersToDelete = make(map[string]string)
		}
		foldersToDelete[r.Path] = r.OldUID
	}

	deleteFolders(ctx, foldersToDelete, repositoryResources, progress, tracer)
	metrics.RecordIncrementalSyncPhase(jobs.IncrementalSyncPhaseCleanup, time.Since(cleanupStart))

	// Run after deleteFolders so its informational warnings (e.g. missing
	// _folder.json) don't interfere with HasChildPathFailedUpdate safety checks.
	if folderMetadataEnabled {
		if err := detectMissingFolderMetadata(ctx, repo, currentRef, diff, progress, tracer); err != nil {
			return err
		}
	}

	return nil
}

//nolint:gocyclo
func applyIncrementalChanges(ctx context.Context, diff []repository.VersionedFileChange, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, span trace.Span, quotaTracker quotas.QuotaTracker, folderMetadataEnabled bool) (affectedFolders map[string]string, err error) {
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
				folder, fErr := repositoryResources.EnsureFolderPathExist(folderCtx, change.Path)
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

		if folderMetadataEnabled && resources.IsFolderMetadataFile(change.Path) {
			if change.Action == repository.FileActionCreated || change.Action == repository.FileActionUpdated {
				name, err := applyFolderMetadataUpdate(ctx, change, repositoryResources, tracer)
				if err != nil {
					resultBuilder.WithError(err)
				}
				resultBuilder.WithName(name)
			}
			// Metadata files are not Grafana resources. Deletions are handled by
			// planFolderMetadataChanges; other actions are no-ops.
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
			writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.write_resource_from_file")
			var name string
			var gvk schema.GroupVersionKind
			var writeErr error

			if change.PreviousRef != "" {
				name, gvk, writeErr = repositoryResources.ReplaceResourceFromFileByRef(writeCtx, change.Path, change.Ref, change.PreviousRef)
			} else {
				name, gvk, writeErr = repositoryResources.WriteResourceFromFile(writeCtx, change.Path, change.Ref)
			}

			if writeErr != nil {
				writeSpan.RecordError(writeErr)
				resultBuilder.WithError(fmt.Errorf("writing resource from file %s: %w", change.Path, writeErr))
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

// replacedFolder tracks a folder whose UID changed due to a _folder.json
// update or deletion. The old folder needs cleanup after children are re-parented.
type replacedFolder struct {
	Path   string // folder dir path (with trailing slash)
	OldUID string // the previous folder UID to delete after children are re-parented
}

// planFolderMetadataChanges detects UID changes in updated or deleted _folder.json
// files, emits synthetic FileActionUpdated for direct children so they get
// re-parented, and returns the list of old folder UIDs to clean up.
//
// For _folder.json updates: reads the new metadata to get the new UID.
// For _folder.json deletions: computes the hash-based UID that the folder
// reverts to when metadata is removed.
func planFolderMetadataChanges(
	ctx context.Context,
	repo repository.Reader,
	currentRef string,
	diff []repository.VersionedFileChange,
	repositoryResources resources.RepositoryResources,
	tracer tracing.Tracer,
) ([]repository.VersionedFileChange, []replacedFolder, error) {
	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.plan_folder_metadata_changes")
	defer span.End()

	var metadataUpdateIndices []int
	var metadataDeletionIndices []int
	for i, change := range diff {
		if !resources.IsFolderMetadataFile(change.Path) {
			continue
		}
		switch change.Action {
		case repository.FileActionUpdated:
			metadataUpdateIndices = append(metadataUpdateIndices, i)
		case repository.FileActionDeleted:
			metadataDeletionIndices = append(metadataDeletionIndices, i)
		default:
		}
	}
	if len(metadataUpdateIndices) == 0 && len(metadataDeletionIndices) == 0 {
		return diff, nil, nil
	}

	existingResources, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("list existing resources: %w", err)
	}

	existingFoldersByPath := make(map[string]string)
	for i := range existingResources.Items {
		item := &existingResources.Items[i]
		if item.Group == resources.FolderResource.Group {
			path := safepath.EnsureTrailingSlash(item.Path)
			existingFoldersByPath[path] = item.Name
		}
	}

	var replaced []replacedFolder
	oldUIDSet := make(map[string]struct{})

	// Detect UID changes from _folder.json updates.
	for _, idx := range metadataUpdateIndices {
		change := diff[idx]
		folderDir := safepath.Dir(change.Path)

		oldUID, ok := existingFoldersByPath[folderDir]
		if !ok {
			continue
		}

		newFolder, err := resources.ParseFolderWithMetadata(ctx, repo, folderDir, currentRef, true)
		if err != nil {
			span.RecordError(err)
			return nil, nil, fmt.Errorf("parse folder metadata for %s at ref %s: %w", folderDir, currentRef, err)
		}

		if newFolder.ID == oldUID {
			continue
		}

		repositoryResources.RemoveFolderFromTree(oldUID)
		replaced = append(replaced, replacedFolder{
			Path:   folderDir,
			OldUID: oldUID,
		})
		oldUIDSet[oldUID] = struct{}{}
	}

	// Detect UID transitions from _folder.json deletions.
	// When metadata is removed the folder reverts to a hash-derived UID.
	for _, idx := range metadataDeletionIndices {
		change := diff[idx]
		folderDir := safepath.Dir(change.Path)

		oldUID, ok := existingFoldersByPath[folderDir]
		if !ok {
			continue
		}

		// Any non-NotFound error is treated as a hard failure to avoid
		// triggering an incorrect UID transition on transient errors.
		_, readErr := repo.Read(ctx, folderDir, currentRef)
		if readErr != nil {
			if errors.Is(readErr, repository.ErrFileNotFound) || apierrors.IsNotFound(readErr) {
				// Directory gone — schedule old folder for deletion.
				// No synthetic child updates are needed since all
				// children should already be removed by other diff
				// entries or previous syncs. We can't rely on
				// findOrphanedFolders because _folder.json deletions
				// are skipped in the apply phase and may not populate
				// affectedFolders.
				replaced = append(replaced, replacedFolder{
					Path:   folderDir,
					OldUID: oldUID,
				})
				continue
			}
			return nil, nil, fmt.Errorf("read folder directory %s at ref %s: %w", folderDir, currentRef, readErr)
		}

		newUID := resources.ParseFolder(folderDir, repo.Config().Name).ID

		if newUID != oldUID {
			repositoryResources.RemoveFolderFromTree(oldUID)
			replaced = append(replaced, replacedFolder{
				Path:   folderDir,
				OldUID: oldUID,
			})
			oldUIDSet[oldUID] = struct{}{}
		}

		// Emit a folder directory update so the folder is recreated with the
		// hash-based UID (or updated to clear the stale metadata hash).
		diff = append(diff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderDir,
			Ref:    currentRef,
		})
	}

	if len(oldUIDSet) == 0 {
		return diff, replaced, nil
	}

	actionsInDiff := make(map[string]repository.FileAction, len(diff))
	for _, c := range diff {
		actionsInDiff[c.Path] = c.Action
		if c.PreviousPath != "" {
			actionsInDiff[c.PreviousPath] = c.Action
		}
		// A _folder.json change already covers its parent directory — the folder
		// will be created/updated via applyFolderMetadataUpdate, so we don't need
		// a synthetic directory update for it.
		if resources.IsFolderMetadataFile(c.Path) {
			actionsInDiff[safepath.Dir(c.Path)] = repository.FileActionUpdated
		}
	}

	for i := range existingResources.Items {
		item := &existingResources.Items[i]
		if _, ok := oldUIDSet[item.Folder]; !ok {
			continue
		}

		path := item.Path
		if item.Group == resources.FolderResource.Group {
			path = safepath.EnsureTrailingSlash(path)
		}

		if resources.IsFolderMetadataFile(path) {
			continue
		}
		if _, inDiff := actionsInDiff[path]; inDiff {
			continue
		}

		diff = append(diff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   path,
			Ref:    currentRef,
		})
		actionsInDiff[path] = repository.FileActionUpdated
	}

	return diff, replaced, nil
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
	default:
		return 4
	}
}

// findOrphanedFolders checks which affected folders no longer exist in git
// and returns a path->UID map of folders to delete.
func findOrphanedFolders(
	ctx context.Context,
	repo repository.Versioned,
	affectedFolders map[string]string,
	tracer tracing.Tracer,
) map[string]string {
	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.find_orphaned_folders")
	defer span.End()

	readerRepo, ok := repo.(repository.Reader)
	if !ok {
		span.RecordError(fmt.Errorf("repository does not implement Reader"))
		return nil
	}

	orphaned := make(map[string]string)
	for path, folderName := range affectedFolders {
		span.SetAttributes(attribute.String("folder", folderName))

		_, err := readerRepo.Read(ctx, path, "")
		if err != nil && (errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			span.AddEvent("folder not found in git, marking for deletion")
			orphaned[path] = folderName
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
	foldersToDelete map[string]string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
) {
	if len(foldersToDelete) == 0 {
		return
	}

	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental.delete_folders")
	defer span.End()

	type pathUID struct {
		Path string
		UID  string
	}
	sorted := make([]pathUID, 0, len(foldersToDelete))
	for path, uid := range foldersToDelete {
		sorted = append(sorted, pathUID{Path: path, UID: uid})
	}
	safepath.SortByDepth(sorted, func(p pathUID) string { return p.Path }, false)

	for _, entry := range sorted {
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

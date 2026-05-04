package sync

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// ApplyPhase is the phase identifier reported by the shared apply pipeline.
// Callers map it to their own metric space (full vs incremental).
type ApplyPhase int

const (
	ApplyPhaseFileDeletions ApplyPhase = iota
	ApplyPhaseFolderCreations
	ApplyPhaseFileRenames
	ApplyPhaseFolderDeletions
	ApplyPhaseFileCreations
	ApplyPhaseOldFolderCleanup
)

// ApplyPhaseRecorder is an optional callback that receives per-phase timings
// from the shared apply pipeline. Implementations translate these into their
// own metric space. Passing nil disables phase recording.
type ApplyPhaseRecorder func(phase ApplyPhase, duration time.Duration)

// affectedFolderCollector gathers folder paths whose children were removed
// during apply so incremental sync can later probe git for orphaned folders.
// Full sync doesn't need it because Compare() produces orphan deletions
// directly from the source-vs-target join.
type affectedFolderCollector struct {
	mu sync.Mutex
	m  map[string]string
}

func newAffectedFolderCollector() *affectedFolderCollector {
	return &affectedFolderCollector{m: make(map[string]string)}
}

func (c *affectedFolderCollector) Add(path, folderUID string) {
	if c == nil || folderUID == "" || path == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[path] = folderUID
}

func (c *affectedFolderCollector) Map() map[string]string {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[string]string, len(c.m))
	for k, v := range c.m {
		out[k] = v
	}
	return out
}

// applyDeps groups the per-sync dependencies threaded through apply. The struct
// exists so each change can be processed without passing a long argument list
// and to keep the shared apply engine backward-compatible with both sync flows.
type applyDeps struct {
	clients               resources.ResourceClients
	currentRef            string
	repositoryResources   resources.RepositoryResources
	progress              jobs.JobProgressRecorder
	tracer                tracing.Tracer
	quotaTracker          quotas.QuotaTracker
	folderMetadataEnabled bool
	affected              *affectedFolderCollector
}

// shouldSkipChange checks if a change should be skipped based on previous failures on parent/child folders.
// If there is a previous failure on the path, we don't need to process the change as it will fail anyway.
func shouldSkipChange(ctx context.Context, change ResourceFileChange, progress jobs.JobProgressRecorder, tracer tracing.Tracer) bool {
	if change.Action != repository.FileActionDeleted && progress.HasDirPathFailedCreation(change.Path) {
		skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.apply.skip_nested_resource")
		skipSpan.SetAttributes(attribute.String("path", change.Path))

		progress.Record(skipCtx, jobs.NewPathOnlyResult(change.Path).
			WithError(fmt.Errorf("resource was not processed because the parent folder could not be created")).
			AsSkipped().
			Build())
		skipSpan.End()
		return true
	}

	if change.Action == repository.FileActionDeleted && safepath.IsDir(change.Path) && progress.HasDirPathFailedDeletion(change.Path) {
		skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.apply.skip_folder_with_failed_deletions")
		skipSpan.SetAttributes(attribute.String("path", change.Path))
		progress.Record(skipCtx, jobs.NewResourceResult().
			WithGroup(resources.FolderKind.Group).
			WithKind(resources.FolderKind.Kind).
			WithPath(change.Path).
			WithError(fmt.Errorf("folder was not processed because children resources in its path could not be deleted")).
			AsSkipped().
			Build())
		skipSpan.End()
		return true
	}

	return false
}

// refFor returns the ref at which the new-side of a change lives, falling back
// to the outer currentRef when the change itself doesn't carry one. Full-sync
// changes rely on currentRef; incremental ones carry their own.
func refFor(change ResourceFileChange, currentRef string) string {
	if change.Ref != "" {
		return change.Ref
	}
	return currentRef
}

// applyChange applies a single resource or folder change, handling
// delete/create/update/rename and recording progress.
//
// Delete/Update/Renamed dispatch based on whether the change carries a
// PreviousRef (incremental origin) or not (full origin). This preserves the
// exact primitive invocation each sync relied on before unification, so the
// shared apply does not regress integration-test-visible behavior.
//
//nolint:gocyclo
func applyChange(ctx context.Context, change ResourceFileChange, deps applyDeps) {
	if ctx.Err() != nil {
		return
	}

	if change.RecordOnly {
		// Preserve incremental sync's original asymmetric skip check: only
		// non-deleted entries consult HasDirPathFailedCreation so nested
		// resources under a failed parent surface a skipped result. Deleted
		// directory entries are recorded as-is because deletion cleanup is
		// handled by the orphan pass downstream.
		if change.Action != repository.FileActionDeleted && deps.progress.HasDirPathFailedCreation(change.Path) {
			deps.progress.Record(ctx, jobs.NewPathOnlyResult(change.Path).
				WithError(fmt.Errorf("resource was not processed because the parent folder could not be created")).
				AsSkipped().
				Build())
			return
		}
		deps.progress.Record(ctx, jobs.NewPathOnlyResult(change.Path).
			WithAction(change.Action).
			Build())
		return
	}

	if shouldSkipChange(ctx, change, deps.progress, deps.tracer) {
		return
	}

	ref := refFor(change, deps.currentRef)

	if change.UnsupportedSafeSegment != "" {
		applyUnsupportedSafeSegment(ctx, change, ref, deps)
		return
	}

	switch change.Action {
	case repository.FileActionDeleted:
		applyDelete(ctx, change, deps)
		return

	case repository.FileActionIgnored:
		// Preserve incremental-sync behavior of emitting a path-only ignored
		// record so downstream progress aggregation reports the change.
		deps.progress.Record(ctx, jobs.NewPathOnlyResult(change.Path).
			WithAction(change.Action).
			Build())
		return

	case repository.FileActionRenamed:
		// Incremental-origin renames carry PreviousPath+PreviousRef and need
		// the previous-ref-aware rename primitives. Full-origin renames come
		// from DetectRenames (content preserved) and are written to the new
		// path; identity is retained because the payload is byte-identical.
		if change.PreviousPath != "" && change.PreviousRef != "" {
			applyRename(ctx, change, ref, deps)
			return
		}
	}

	if safepath.IsDir(change.Path) {
		applyFolderChange(ctx, change, ref, deps)
		return
	}

	if change.Action == repository.FileActionCreated && !deps.quotaTracker.TryAcquire() {
		deps.progress.Record(ctx, jobs.NewPathOnlyResult(change.Path).
			WithAction(change.Action).
			WithError(quotas.NewQuotaExceededError(fmt.Errorf("resource quota exceeded, skipping creation of %s", change.Path))).
			AsSkipped().
			Build())
		return
	}

	applyFileWrite(ctx, change, ref, deps)
}

// applyDelete handles FileActionDeleted for both folder and file changes.
// Folder deletions always use client.Delete(Existing.Name) since incremental's
// BuildIncrementalDiff converts folder deletes into other flows; any folder
// FileActionDeleted reaching here is full-sync-origin.
func applyDelete(ctx context.Context, change ResourceFileChange, deps applyDeps) {
	// Incremental origin: go through RemoveResourceFromFile to validate
	// ownership and surface the affected folder for orphan detection.
	if change.PreviousRef != "" && !safepath.IsDir(change.Path) {
		applyIncrementalFileDelete(ctx, change, deps)
		return
	}

	deleteCtx, deleteSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.delete")
	defer deleteSpan.End()

	resultBuilder := jobs.NewPathOnlyResult(change.Path).WithAction(change.Action)

	if change.Existing == nil || change.Existing.Name == "" {
		result := resultBuilder.WithError(fmt.Errorf("processing deletion for file %s: missing existing reference", change.Path)).Build()
		deps.progress.Record(deleteCtx, result)
		deleteSpan.RecordError(result.Error())
		return
	}

	versionlessGVR := schema.GroupVersionResource{
		Group:    change.Existing.Group,
		Resource: change.Existing.Resource,
	}

	client, gvk, err := deps.clients.ForResource(deleteCtx, versionlessGVR)
	if err != nil {
		resultBuilder.WithError(fmt.Errorf("get client for deleted object: %w", err)).
			WithName(change.Existing.Name).
			WithGroup(change.Existing.Group).
			WithKind(versionlessGVR.Resource)
		deps.progress.Record(deleteCtx, resultBuilder.Build())
		return
	}

	resultBuilder.WithName(change.Existing.Name).WithGVK(gvk)

	if err := client.Delete(deleteCtx, change.Existing.Name, metav1.DeleteOptions{}); err != nil {
		resultBuilder.WithError(fmt.Errorf("deleting resource %s/%s %s: %w", change.Existing.Group, gvk.Kind, change.Existing.Name, err))
	} else {
		deps.quotaTracker.Release()
		// Keep this tree mutation scoped to folder metadata for now.
		// It clears the deleted folder's stale in-memory entry so the same
		// sync can recreate that folder at a new path when _folder.json
		// preserves the UID.
		if deps.folderMetadataEnabled && safepath.IsDir(change.Path) {
			logging.FromContext(deleteCtx).Debug("folder tree entry removed after delete", "path", change.Path, "uid", change.Existing.Name)
			deps.repositoryResources.RemoveFolderFromTree(change.Existing.Name)
		}
	}
	deps.progress.Record(deleteCtx, resultBuilder.Build())
}

// applyIncrementalFileDelete performs an incremental-origin file deletion via
// RemoveResourceFromFile, which reads the previous-ref file to resolve the
// resource identity and returns the folder that owned the resource so orphan
// detection can track it.
func applyIncrementalFileDelete(ctx context.Context, change ResourceFileChange, deps applyDeps) {
	removeCtx, removeSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.remove_resource_from_file")
	defer removeSpan.End()

	resultBuilder := jobs.NewPathOnlyResult(change.Path).WithAction(change.Action)

	name, folderName, gvk, err := deps.repositoryResources.RemoveResourceFromFile(removeCtx, change.Path, change.PreviousRef)
	if err != nil {
		removeSpan.RecordError(err)
		resultBuilder.WithError(fmt.Errorf("removing resource from file %s: %w", change.Path, err))
	} else {
		deps.quotaTracker.Release()
	}
	resultBuilder.WithName(name).WithGVK(gvk)

	if folderName != "" {
		deps.affected.Add(safepath.Dir(change.Path), folderName)
	}

	deps.progress.Record(removeCtx, resultBuilder.Build())
}

// applyRename handles an incremental-origin rename. Folder renames go through
// RenameFolderPath; file renames go through RenameResourceFile.
func applyRename(ctx context.Context, change ResourceFileChange, ref string, deps applyDeps) {
	resultBuilder := jobs.NewPathOnlyResult(change.Path).
		WithAction(change.Action).
		WithPreviousPath(change.PreviousPath)

	if safepath.IsDir(change.Path) {
		renameFolderCtx, renameFolderSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.rename_folder_path")
		defer renameFolderSpan.End()

		opts := ensurePathOptionsFor(change)
		oldFolderID, err := deps.repositoryResources.RenameFolderPath(renameFolderCtx, change.PreviousPath, change.PreviousRef, change.Path, ref, opts...)
		if err != nil {
			renameFolderSpan.RecordError(err)
			resultBuilder.WithError(fmt.Errorf("renaming folder from %s to %s: %w", change.PreviousPath, change.Path, err))
		}
		if oldFolderID != "" {
			deps.affected.Add(change.PreviousPath, oldFolderID)
		}
		deps.progress.Record(renameFolderCtx, resultBuilder.Build())
		return
	}

	renameCtx, renameSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.rename_resource_file")
	defer renameSpan.End()

	opts := ensurePathOptionsFor(change)
	name, oldFolderName, gvk, err := deps.repositoryResources.RenameResourceFile(renameCtx, change.PreviousPath, change.PreviousRef, change.Path, ref, opts...)
	if err != nil {
		renameSpan.RecordError(err)
		resultBuilder.WithError(fmt.Errorf("renaming resource file from %s to %s: %w", change.PreviousPath, change.Path, err))
	}
	resultBuilder.WithName(name).WithGVK(gvk)

	if oldFolderName != "" {
		deps.affected.Add(safepath.Dir(change.PreviousPath), oldFolderName)
	}

	deps.progress.Record(renameCtx, resultBuilder.Build())
}

// applyUnsupportedSafeSegment materialises the folder at the ancestor safe
// segment of an unsupported incremental diff entry. Preserves the pre-refactor
// behavior of recording the result at the safe segment while tracking skip
// state against the original unsupported path (already done in shouldSkipChange).
func applyUnsupportedSafeSegment(ctx context.Context, change ResourceFileChange, ref string, deps applyDeps) {
	ensureCtx, ensureSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.ensure_folder_path_exist_safe_segment")
	defer ensureSpan.End()

	safeSeg := change.UnsupportedSafeSegment
	folder, err := deps.repositoryResources.EnsureFolderPathExist(ensureCtx, safeSeg, ref)
	if err != nil {
		ensureSpan.RecordError(err)
		deps.progress.Record(ensureCtx, jobs.NewFolderResult(change.Path).
			WithError(err).
			WithAction(repository.FileActionIgnored).
			Build())
		return
	}
	deps.progress.Record(ensureCtx, jobs.NewFolderResult(folder).
		WithPath(safeSeg).
		WithAction(repository.FileActionCreated).
		Build())
}

// applyFolderChange handles non-delete folder entries: creations and updates.
// Quota enforcement for folder creation is handled by the beforeCreate hook
// configured on FolderManager.
func applyFolderChange(ctx context.Context, change ResourceFileChange, ref string, deps applyDeps) {
	ensureFolderCtx, ensureFolderSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.ensure_folder_exists")
	defer ensureFolderSpan.End()

	resultBuilder := jobs.NewFolderResult(change.Path).WithAction(change.Action)

	opts := ensurePathOptionsFor(change)
	if change.Action == repository.FileActionUpdated {
		// Force the full ancestor walk so parent-only changes are not skipped
		// by the early-return optimisation.
		opts = append(opts, resources.WithForceWalk())
		// Mark the old UID as relocating so the ID conflict check is bypassed
		// at the new path. Full sync populates Existing; incremental re-parent
		// changes populate RelocatingUIDs via the folder-metadata rebuilder.
		if change.Existing != nil {
			opts = append(opts, resources.WithRelocatingUIDs(change.Existing.Name))
		}
	}

	folder, err := deps.repositoryResources.EnsureFolderPathExist(ensureFolderCtx, change.Path, ref, opts...)
	if err != nil {
		// FileActionUpdated on a directory comes from incremental's folder
		// metadata re-parenting flow; keep its error wording so downstream
		// diagnostics (and the contract test) reflect that semantic.
		if change.Action == repository.FileActionUpdated {
			resultBuilder.WithError(fmt.Errorf("re-parenting child folder at %s: %w", change.Path, err))
		} else {
			resultBuilder.WithError(fmt.Errorf("ensuring folder exists at path %s: %w", change.Path, err))
		}
		ensureFolderSpan.RecordError(err)
		deps.progress.Record(ctx, resultBuilder.Build())
		return
	}

	resultBuilder.WithName(folder)
	deps.progress.Record(ensureFolderCtx, resultBuilder.Build())
}

// applyFileWrite handles Create/Update/Rename-without-previous-ref by writing
// the file's new content. For Updated with a known Existing identity we route
// through ReplaceResourceFromFile so renames-via-content-write can clean up
// the prior resource; otherwise WriteResourceFromFile suffices.
func applyFileWrite(ctx context.Context, change ResourceFileChange, ref string, deps applyDeps) {
	writeCtx, writeSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.write_resource_from_file")
	defer writeSpan.End()

	var (
		name   string
		gvk    schema.GroupVersionKind
		err    error
		errMsg = "writing resource from file %s: %w"
	)

	switch {
	case change.Action == repository.FileActionUpdated && change.PreviousRef != "":
		name, gvk, err = deps.repositoryResources.ReplaceResourceFromFileByRef(writeCtx, change.Path, ref, change.PreviousRef)
		errMsg = "replacing resource from file %s: %w"
	case change.Action == repository.FileActionUpdated && change.Existing != nil && change.Existing.Name != "":
		oldGVR := schema.GroupVersionResource{
			Group:    change.Existing.Group,
			Resource: change.Existing.Resource,
		}
		name, gvk, err = deps.repositoryResources.ReplaceResourceFromFile(writeCtx, change.Path, ref, change.Existing.Name, oldGVR)
	default:
		name, gvk, err = deps.repositoryResources.WriteResourceFromFile(writeCtx, change.Path, ref)
	}

	resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(change.Action).WithPath(change.Path)
	if err != nil {
		writeSpan.RecordError(err)
		resultBuilder.WithError(fmt.Errorf(errMsg, change.Path, err))
	}
	deps.progress.Record(writeCtx, resultBuilder.Build())
}

// ensurePathOptionsFor returns the EnsurePathOptions that should be threaded
// through folder operations for the given change. Callers append additional
// options (e.g. WithForceWalk) on top.
func ensurePathOptionsFor(change ResourceFileChange) []resources.EnsurePathOption {
	if len(change.RelocatingUIDs) == 0 {
		return nil
	}
	return []resources.EnsurePathOption{resources.WithRelocatingUIDs(change.RelocatingUIDs...)}
}

// applyChanges orders and executes the diff:
//   - deletions first (files then folders),
//   - then folder creations,
//   - then file renames,
//   - then folder deletions,
//   - then file creations/updates,
//   - then old-folder cleanup for changes marked FolderRenamed.
//
// Folder operations are executed serially (shallow-first for creations,
// deep-first for deletions) while file operations run in parallel bounded by
// maxSyncWorkers.
func applyChanges(
	ctx context.Context,
	changes []ResourceFileChange,
	deps applyDeps,
	maxSyncWorkers int,
	phase ApplyPhaseRecorder,
) error {
	deps.progress.SetTotal(ctx, len(changes))

	_, applyChangesSpan := deps.tracer.Start(ctx, "provisioning.sync.apply_changes",
		trace.WithAttributes(attribute.Int("changes_count", len(changes))),
	)
	defer applyChangesSpan.End()

	// Bucket changes by operation type so the six phases have stable, ordered inputs.
	var fileDeletions, folderCreations, fileRenames, folderDeletions, fileCreations []ResourceFileChange

	for _, change := range changes {
		isFolder := safepath.IsDir(change.Path)

		switch {
		case change.Action == repository.FileActionIgnored:
			// Incremental sync still needs each Ignored entry to go through
			// the per-change loop so TooManyErrors and HasDirPathFailedCreation
			// run exactly like the pre-refactor flow; route through file
			// creations (serial at maxSyncWorkers=1 for incremental) and let
			// applyChange short-circuit to a path-only record.
			fileCreations = append(fileCreations, change)
		case change.RecordOnly && change.Action == repository.FileActionDeleted:
			folderDeletions = append(folderDeletions, change)
		case change.RecordOnly:
			folderCreations = append(folderCreations, change)
		case change.UnsupportedSafeSegment != "":
			folderCreations = append(folderCreations, change)
		case change.Action == repository.FileActionRenamed && !isFolder:
			fileRenames = append(fileRenames, change)
		case change.Action == repository.FileActionRenamed && isFolder:
			// Folder renames are only produced by incremental sync via
			// RenameFolderPath; sequence them alongside folder creations so
			// destination folders exist before child ops.
			folderCreations = append(folderCreations, change)
		case change.Action == repository.FileActionDeleted && !isFolder:
			fileDeletions = append(fileDeletions, change)
		case change.Action == repository.FileActionDeleted && isFolder:
			folderDeletions = append(folderDeletions, change)
		case isFolder:
			folderCreations = append(folderCreations, change)
		default:
			fileCreations = append(fileCreations, change)
		}
	}

	applyChangesSpan.SetAttributes(
		attribute.Int("file_renames", len(fileRenames)),
		attribute.Int("file_deletions", len(fileDeletions)),
		attribute.Int("folder_deletions", len(folderDeletions)),
		attribute.Int("folder_creations", len(folderCreations)),
		attribute.Int("file_creations", len(fileCreations)),
	)

	if len(fileDeletions) > 0 {
		if err := instrumentedPhase(ApplyPhaseFileDeletions, phase, func() error {
			return applyResourcesInParallel(ctx, fileDeletions, deps, maxSyncWorkers)
		}); err != nil {
			return err
		}
	}

	if len(folderCreations) > 0 {
		// Process folder creations/updates shallowest-first so that parent folders are set up (and their old tree entries removed)
		// before children are walked to ensure consistency in moves and renames.
		safepath.SortByDepth(folderCreations, func(c ResourceFileChange) string {
			if c.UnsupportedSafeSegment != "" {
				return c.UnsupportedSafeSegment
			}
			return c.Path
		}, true)
		if err := instrumentedPhase(ApplyPhaseFolderCreations, phase, func() error {
			return applyFoldersSerially(ctx, folderCreations, deps)
		}); err != nil {
			return err
		}
	}

	if len(fileRenames) > 0 {
		if err := instrumentedPhase(ApplyPhaseFileRenames, phase, func() error {
			return applyResourcesInParallel(ctx, fileRenames, deps, maxSyncWorkers)
		}); err != nil {
			return err
		}
	}

	if len(folderDeletions) > 0 {
		if err := instrumentedPhase(ApplyPhaseFolderDeletions, phase, func() error {
			return applyFoldersSerially(ctx, folderDeletions, deps)
		}); err != nil {
			return err
		}
	}

	if len(fileCreations) > 0 {
		if err := instrumentedPhase(ApplyPhaseFileCreations, phase, func() error {
			return applyResourcesInParallel(ctx, fileCreations, deps, maxSyncWorkers)
		}); err != nil {
			return err
		}
	}

	// Collect and delete old folders (full sync's old-folder cleanup) after all
	// children have been re-parented. This only applies to changes marked
	// FolderRenamed, which full sync emits for UID-preserving folder updates.
	type oldFolder struct {
		Path   string
		UID    string
		Reason string
	}
	var oldFolders []oldFolder
	for _, change := range folderCreations {
		if change.FolderRenamed && change.Existing != nil {
			oldFolders = append(oldFolders, oldFolder{Path: change.Path, UID: change.Existing.Name, Reason: change.Reason})
		}
	}

	if len(oldFolders) > 0 {
		logging.FromContext(ctx).Info("folder rename cleanup", "count", len(oldFolders))
		if err := instrumentedPhase(ApplyPhaseOldFolderCleanup, phase, func() error {
			safepath.SortByDepth(oldFolders, func(f oldFolder) string { return f.Path }, false)
			for _, old := range oldFolders {
				if ctx.Err() != nil {
					break
				}
				if err := deps.progress.TooManyErrors(); err != nil {
					return err
				}

				// Skip if the replacement folder failed to be created or updated (e.g. UID conflict warning).
				if deps.progress.HasDirPathFailedCreation(old.Path) || deps.progress.HasChildPathFailedUpdate(old.Path) {
					skipCtx, skipSpan := deps.tracer.Start(ctx, "provisioning.sync.apply.skip_renamed_folder_deletion")
					deps.progress.Record(skipCtx, jobs.NewPathOnlyResult(old.Path).
						WithError(fmt.Errorf("old folder was not deleted because the replacement folder could not be created")).
						AsSkipped().
						Build())
					skipSpan.End()
					continue
				}

				resultBuilder := jobs.NewFolderResult(old.Path).
					WithAction(repository.FileActionDeleted).
					WithName(old.UID).
					WithReason(old.Reason)
				if err := deps.repositoryResources.RemoveFolder(ctx, old.UID); err != nil {
					resultBuilder.WithError(fmt.Errorf("delete old folder %s after UID change: %w", old.UID, err))
				}
				deps.progress.Record(ctx, resultBuilder.Build())
			}
			return nil
		}); err != nil {
			return err
		}
	}

	return nil
}

// instrumentedPhase records timing for a shared apply phase via the caller's
// phase recorder, if any.
func instrumentedPhase(p ApplyPhase, recorder ApplyPhaseRecorder, fn func() error) error {
	start := time.Now()
	err := fn()
	if recorder != nil {
		recorder(p, time.Since(start))
	}
	return err
}

// applyFoldersSerially processes folder changes one by one. Mirrors the
// pre-refactor incremental order: ctx.Err() is checked before TooManyErrors
// so a pre-cancelled context skips the error poll entirely.
func applyFoldersSerially(ctx context.Context, folders []ResourceFileChange, deps applyDeps) error {
	for _, folder := range folders {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := deps.progress.TooManyErrors(); err != nil {
			return err
		}

		wrapWithTimeout(ctx, 15*time.Second, func(timeoutCtx context.Context) {
			applyChange(timeoutCtx, folder, deps)
		})
	}

	return nil
}

// applyResourcesInParallel applies non-folder changes concurrently up to maxSyncWorkers.
// Folder changes are handled serially, this is for files.
func applyResourcesInParallel(ctx context.Context, changes []ResourceFileChange, deps applyDeps, maxSyncWorkers int) error {
	if len(changes) == 0 {
		return nil
	}

	sem := make(chan struct{}, maxSyncWorkers)
	var wg sync.WaitGroup

loop:
	for _, change := range changes {
		if ctx.Err() != nil {
			break
		}
		if err := deps.progress.TooManyErrors(); err != nil {
			break
		}

		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			break loop
		}

		wg.Add(1)
		go func(change ResourceFileChange) {
			defer wg.Done()
			defer func() { <-sem }()

			wrapWithTimeout(ctx, 15*time.Second, func(timeoutCtx context.Context) {
				applyChange(timeoutCtx, change, deps)
			})
		}(change)
	}

	wg.Wait()

	if ctxErr := ctx.Err(); ctxErr != nil {
		return ctxErr
	}
	return deps.progress.TooManyErrors()
}

// wrapWithTimeout runs fn with a derived context that times out after the given duration.
func wrapWithTimeout(ctx context.Context, timeout time.Duration, fn func(context.Context)) {
	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	fn(timeoutCtx)
}

// checkQuotaBeforeSync checks if the repository is over quota and if the sync would exceed the quota limit.
// Returns a QuotaExceededError if the sync should be blocked, nil otherwise.
func checkQuotaBeforeSync(ctx context.Context, repo repository.Repository, changes []ResourceFileChange, tracer tracing.Tracer) error {
	if !quotas.IsQuotaExceeded(repo.Config().Status.Conditions) {
		return nil
	}

	cfg := repo.Config()
	quotaUsage := quotas.NewQuotaUsageFromStats(cfg.Status.Stats)

	// Calculate the net change in resource count (positive for additions, negative for deletions)
	var netChange int64
	allDeletions := true
	for _, change := range changes {
		if change.Action != repository.FileActionDeleted {
			allDeletions = false
		}

		switch change.Action {
		case repository.FileActionCreated:
			netChange++
		case repository.FileActionDeleted:
			netChange--
		case repository.FileActionUpdated, repository.FileActionRenamed, repository.FileActionIgnored:
			// change does not affect quota
		default:
			logger.Error("unknown change action", "action", change.Action)
		}
	}

	// If only deletions, allow the sync since it can only reduce resource usage.
	if allDeletions {
		return nil
	}

	if !quotas.WouldStayWithinQuota(cfg.Status.Quota, quotaUsage, netChange) {
		return quotas.NewQuotaExceededError(fmt.Errorf(
			"usage %d/%d, incoming changes do not free enough resources",
			quotaUsage.TotalResources, cfg.Status.Quota.MaxResourcesPerRepository,
		))
	}

	return nil
}

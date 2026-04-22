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
			ensureFolderSpan.End()
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

	return applyChanges(ctx, changes, clients, currentRef, repositoryResources, progress, tracer, maxSyncWorkers, metrics, quotaTracker, folderMetadataEnabled)
}

// shouldSkipChange checks if a change should be skipped based on previous failures on parent/child folders.
// If there is a previous failure on the path, we don't need to process the change as it will fail anyway.
func shouldSkipChange(ctx context.Context, change ResourceFileChange, progress jobs.JobProgressRecorder, tracer tracing.Tracer) bool {
	if change.Action != repository.FileActionDeleted && progress.HasDirPathFailedCreation(change.Path) {
		skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.skip_nested_resource")
		skipSpan.SetAttributes(attribute.String("path", change.Path))

		progress.Record(skipCtx, jobs.NewPathOnlyResult(change.Path).
			WithError(fmt.Errorf("resource was not processed because the parent folder could not be created")).
			AsSkipped().
			Build())
		skipSpan.End()
		return true
	}

	if change.Action == repository.FileActionDeleted && safepath.IsDir(change.Path) && progress.HasDirPathFailedDeletion(change.Path) {
		skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.skip_folder_with_failed_deletions")
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

// applyChange applies a single resource or folder change, handling delete/create/update and recording progress.
func applyChange(
	ctx context.Context,
	change ResourceFileChange,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) {
	if ctx.Err() != nil {
		return
	}

	if shouldSkipChange(ctx, change, progress, tracer) {
		return
	}

	if change.Action == repository.FileActionDeleted {
		deleteCtx, deleteSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.delete")
		resultBuilder := jobs.NewPathOnlyResult(change.Path).WithAction(change.Action)

		if change.Existing == nil || change.Existing.Name == "" {
			result := resultBuilder.WithError(fmt.Errorf("processing deletion for file %s: missing existing reference", change.Path)).Build()
			progress.Record(deleteCtx, result)
			deleteSpan.RecordError(result.Error())
			deleteSpan.End()
			return
		}

		versionlessGVR := schema.GroupVersionResource{
			Group:    change.Existing.Group,
			Resource: change.Existing.Resource,
		}

		// TODO: should we use the clients or the resource manager instead?
		client, gvk, err := clients.ForResource(deleteCtx, versionlessGVR)
		if err != nil {
			resultBuilder.WithError(fmt.Errorf("get client for deleted object: %w", err)).
				WithName(change.Existing.Name).
				WithGroup(change.Existing.Group).
				WithKind(versionlessGVR.Resource) // could not find a kind
			progress.Record(deleteCtx, resultBuilder.Build())
			deleteSpan.End()
			return
		}

		resultBuilder.WithName(change.Existing.Name).
			WithGVK(gvk)

		if err := client.Delete(deleteCtx, change.Existing.Name, metav1.DeleteOptions{}); err != nil {
			resultBuilder.WithError(fmt.Errorf("deleting resource %s/%s %s: %w", change.Existing.Group, gvk.Kind, change.Existing.Name, err))
		} else {
			quotaTracker.Release()
			// Keep this tree mutation scoped to folder metadata for now.
			// It clears the deleted folder's stale in-memory entry so the same
			// full sync can recreate that folder at a new path when _folder.json
			// preserves the UID.
			if folderMetadataEnabled && safepath.IsDir(change.Path) {
				repositoryResources.RemoveFolderFromTree(change.Existing.Name)
			}
		}
		progress.Record(deleteCtx, resultBuilder.Build())
		deleteSpan.End()
		return
	}

	// Handle folders based on action type
	// Quota for folder creation is enforced by the beforeCreate hook inside EnsureFolderPathExist.
	if safepath.IsDir(change.Path) {
		ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.ensure_folder_exists")
		resultBuilder := jobs.NewFolderResult(change.Path).WithAction(change.Action)

		var ensureOpts []resources.EnsurePathOption
		if change.Action == repository.FileActionUpdated && change.Existing != nil {
			// Force the full ancestor walk so parent-only changes are not skipped
			// by the early-return optimisation, and mark the old UID as relocating
			// so the ID conflict check is bypassed for it at the new path.
			ensureOpts = append(ensureOpts,
				resources.WithForceWalk(),
				resources.WithRelocatingUIDs(change.Existing.Name),
			)
		}

		folder, err := repositoryResources.EnsureFolderPathExist(ensureFolderCtx, change.Path, currentRef, ensureOpts...)
		if err != nil {
			resultBuilder.WithError(fmt.Errorf("ensuring folder exists at path %s: %w", change.Path, err))
			ensureFolderSpan.RecordError(err)
			ensureFolderSpan.End()
			progress.Record(ctx, resultBuilder.Build())

			return
		}

		resultBuilder.WithName(folder)
		progress.Record(ensureFolderCtx, resultBuilder.Build())
		ensureFolderSpan.End()
		return
	}

	if change.Action == repository.FileActionCreated && !quotaTracker.TryAcquire() {
		progress.Record(ctx, jobs.NewPathOnlyResult(change.Path).
			WithAction(change.Action).
			WithError(quotas.NewQuotaExceededError(fmt.Errorf("resource quota exceeded, skipping creation of %s", change.Path))).
			AsSkipped().
			Build())
		return
	}

	writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.write_resource_from_file")
	var name string
	var gvk schema.GroupVersionKind
	var err error

	if change.Action == repository.FileActionUpdated && change.Existing != nil && change.Existing.Name != "" {
		oldGVR := schema.GroupVersionResource{
			Group:    change.Existing.Group,
			Resource: change.Existing.Resource,
		}
		name, gvk, err = repositoryResources.ReplaceResourceFromFile(writeCtx, change.Path, currentRef, change.Existing.Name, oldGVR)
	} else {
		name, gvk, err = repositoryResources.WriteResourceFromFile(writeCtx, change.Path, currentRef)
	}
	resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(change.Action).WithPath(change.Path)
	if err != nil {
		writeSpan.RecordError(err)
		resultBuilder.WithError(fmt.Errorf("writing resource from file %s: %w", change.Path, err))
	}

	progress.Record(writeCtx, resultBuilder.Build())
	writeSpan.End()
}

// instrumentedFullSyncPhase records timing metrics around a full-sync phase.
func instrumentedFullSyncPhase(phase jobs.FullSyncPhase, fn func() error, metrics jobs.JobMetrics) error {
	phaseStart := time.Now()
	err := fn()
	metrics.RecordFullSyncPhase(phase, time.Since(phaseStart))
	return err
}

// applyChanges orders and executes the diff:
// - deletions first (files then folders),
// - then folder creations,
// - then file creations.
// It delegates to:
// - serial folder handling,
// - parallel resource handling with per-change timeouts.
func applyChanges(
	ctx context.Context,
	changes []ResourceFileChange,
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
	progress.SetTotal(ctx, len(changes))

	_, applyChangesSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes",
		trace.WithAttributes(attribute.Int("changes_count", len(changes))),
	)
	defer applyChangesSpan.End()

	buckets := categorizeChanges(changes)

	// Folder renames (FolderRenamed) are net-zero: each creates a new folder
	// and deletes the old one in the cleanup phase. Temporarily raise the
	// quota limit so the creations succeed before the deletions free the slots.
	if buckets.folderRenames > 0 {
		quotaTracker.AllowOverLimit(buckets.folderRenames)
	}

	applyChangesSpan.SetAttributes(
		attribute.Int("file_renames", len(buckets.fileRenames)),
		attribute.Int("file_deletions", len(buckets.fileDeletions)),
		attribute.Int("folder_deletions", len(buckets.folderDeletions)),
		attribute.Int("folder_creations", len(buckets.folderCreations)),
		attribute.Int("file_creations", len(buckets.fileCreations)),
	)

	if len(buckets.fileDeletions) > 0 {
		if err := instrumentedFullSyncPhase(jobs.FullSyncPhaseFileDeletions, func() error {
			return applyResourcesInParallel(ctx, buckets.fileDeletions, clients, currentRef, repositoryResources, progress, tracer, maxSyncWorkers, quotaTracker, folderMetadataEnabled)
		}, metrics); err != nil {
			return err
		}
	}

	if len(buckets.folderCreations) > 0 {
		// Process folder creations/updates shallowest-first so that parent folders are set up (and their old tree entries removed)
		// before children are walked to ensure consistency in moves and renames.
		safepath.SortByDepth(buckets.folderCreations, func(c ResourceFileChange) string { return c.Path }, true)
		if err := instrumentedFullSyncPhase(jobs.FullSyncPhaseFolderCreations, func() error {
			return applyFoldersSerially(ctx, buckets.folderCreations, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled)
		}, metrics); err != nil {
			return err
		}
	}

	if len(buckets.fileRenames) > 0 {
		if err := instrumentedFullSyncPhase(jobs.FullSyncPhaseFileRenames, func() error {
			return applyResourcesInParallel(ctx, buckets.fileRenames, clients, currentRef, repositoryResources, progress, tracer, maxSyncWorkers, quotaTracker, folderMetadataEnabled)
		}, metrics); err != nil {
			return err
		}
	}

	if len(buckets.folderDeletions) > 0 {
		if err := instrumentedFullSyncPhase(jobs.FullSyncPhaseFolderDeletions, func() error {
			return applyFoldersSerially(ctx, buckets.folderDeletions, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled)
		}, metrics); err != nil {
			return err
		}
	}

	if len(buckets.fileCreations) > 0 {
		if err := instrumentedFullSyncPhase(jobs.FullSyncPhaseFileCreations, func() error {
			return applyResourcesInParallel(ctx, buckets.fileCreations, clients, currentRef, repositoryResources, progress, tracer, maxSyncWorkers, quotaTracker, folderMetadataEnabled)
		}, metrics); err != nil {
			return err
		}
	}

	return cleanupRenamedFolders(ctx, buckets.folderCreations, repositoryResources, progress, tracer, metrics)
}

// changeBuckets groups resource changes by the phase in which they must be applied.
type changeBuckets struct {
	fileDeletions   []ResourceFileChange
	folderCreations []ResourceFileChange
	fileRenames     []ResourceFileChange
	folderDeletions []ResourceFileChange
	fileCreations   []ResourceFileChange
	folderRenames   int
}

// categorizeChanges separates changes into ordered phases:
// 1. File deletions (free up folder contents early, must happen before folder deletions)
// 2. Folder creations (destination folders must exist before renames/creates)
// 3. File renames (after destination folders exist, before old folders are deleted)
// 4. Folder deletions (old folders are now empty)
// 5. File creations/updates (must happen after folder creations)
// 6. Old folder deletions (must happen after all children have been re-parented)
// It also counts folder renames so callers can temporarily lift the quota for the
// creation phase (the matching deletions happen later in the old-folder cleanup).
func categorizeChanges(changes []ResourceFileChange) changeBuckets {
	var buckets changeBuckets
	for _, change := range changes {
		isFolder := safepath.IsDir(change.Path)

		switch {
		case change.Action == repository.FileActionRenamed && !isFolder:
			buckets.fileRenames = append(buckets.fileRenames, change)
		case change.Action == repository.FileActionDeleted && !isFolder:
			buckets.fileDeletions = append(buckets.fileDeletions, change)
		case change.Action == repository.FileActionDeleted && isFolder:
			buckets.folderDeletions = append(buckets.folderDeletions, change)
		case isFolder:
			buckets.folderCreations = append(buckets.folderCreations, change)
			if change.FolderRenamed {
				buckets.folderRenames++
			}
		default:
			buckets.fileCreations = append(buckets.fileCreations, change)
		}
	}
	return buckets
}

// cleanupRenamedFolders deletes the original folders left behind after a UID
// change. It runs once all children have been re-parented so that the old
// folder tree is empty and safe to remove.
func cleanupRenamedFolders(
	ctx context.Context,
	folderCreations []ResourceFileChange,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	metrics jobs.JobMetrics,
) error {
	type oldFolder struct {
		Path string
		UID  string
	}

	var oldFolders []oldFolder
	for _, change := range folderCreations {
		if change.FolderRenamed {
			oldFolders = append(oldFolders, oldFolder{Path: change.Path, UID: change.Existing.Name})
		}
	}

	if len(oldFolders) == 0 {
		return nil
	}

	logging.FromContext(ctx).Info("folder rename cleanup", "count", len(oldFolders))
	return instrumentedFullSyncPhase(jobs.FullSyncPhaseOldFolderCleanup, func() error {
		safepath.SortByDepth(oldFolders, func(f oldFolder) string { return f.Path }, false)
		for _, old := range oldFolders {
			if ctx.Err() != nil {
				break
			}

			if err := progress.TooManyErrors(); err != nil {
				return err
			}

			// Skip if the replacement folder failed to be created or updated (e.g. UID conflict warning).
			if progress.HasDirPathFailedCreation(old.Path) || progress.HasChildPathFailedUpdate(old.Path) {
				skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.skip_renamed_folder_deletion")
				progress.Record(skipCtx, jobs.NewPathOnlyResult(old.Path).
					WithError(fmt.Errorf("old folder was not deleted because the replacement folder could not be created")).
					AsSkipped().
					Build())
				skipSpan.End()
				continue
			}

			resultBuilder := jobs.NewFolderResult(old.Path).
				WithAction(repository.FileActionDeleted).
				WithName(old.UID)
			if err := repositoryResources.RemoveFolder(ctx, old.UID); err != nil {
				resultBuilder.WithError(fmt.Errorf("delete old folder %s after UID change: %w", old.UID, err))
			}
			progress.Record(ctx, resultBuilder.Build())
		}
		return nil
	}, metrics)
}

// applyFoldersSerially processes folder changes one by one.
func applyFoldersSerially(
	ctx context.Context,
	folders []ResourceFileChange,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) error {
	for _, folder := range folders {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		wrapWithTimeout(ctx, 15*time.Second, func(timeoutCtx context.Context) {
			applyChange(timeoutCtx, folder, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled)
		})
	}

	return nil
}

// applyResourcesInParallel applies non-folder changes concurrently up to maxSyncWorkers.
// Folder changes are handled serially, this is for files.
func applyResourcesInParallel(
	ctx context.Context,
	resources []ResourceFileChange,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	maxSyncWorkers int,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
) error {
	if len(resources) == 0 {
		return nil
	}

	sem := make(chan struct{}, maxSyncWorkers)
	var wg sync.WaitGroup

loop:
	for _, change := range resources {
		if err := progress.TooManyErrors(); err != nil {
			break
		}
		if ctx.Err() != nil {
			break
		}

		// Acquire semaphore slot (blocks if max workers reached)
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
				applyChange(timeoutCtx, change, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled)
			})
		}(change)
	}

	wg.Wait()

	if err := progress.TooManyErrors(); err != nil {
		return err
	}

	return ctx.Err()
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

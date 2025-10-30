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
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

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

	compareStart := time.Now()
	compareCtx, compareSpan := tracer.Start(ctx, "provisioning.sync.full.compare")
	changes, err := compare(compareCtx, repo, repositoryResources, currentRef)
	if err != nil {
		compareSpan.End()
		return tracing.Error(span, fmt.Errorf("compare changes: %w", err))
	}
	compareSpan.End()
	metrics.RecordFullSyncPhase(jobs.FullSyncPhaseCompare, time.Since(compareStart))

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	return applyChanges(ctx, changes, clients, repositoryResources, progress, tracer, maxSyncWorkers, metrics)
}

func applyChange(ctx context.Context, change ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) {
	if ctx.Err() != nil {
		return
	}

	if change.Action == repository.FileActionDeleted {
		deleteCtx, deleteSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.delete")
		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
		}

		if change.Existing == nil || change.Existing.Name == "" {
			result.Error = fmt.Errorf("processing deletion for file %s: missing existing reference", change.Path)
			progress.Record(deleteCtx, result)
			deleteSpan.RecordError(result.Error)
			deleteSpan.End()
			return
		}
		result.Name = change.Existing.Name
		result.Group = change.Existing.Group

		versionlessGVR := schema.GroupVersionResource{
			Group:    change.Existing.Group,
			Resource: change.Existing.Resource,
		}

		// TODO: should we use the clients or the resource manager instead?
		client, gvk, err := clients.ForResource(deleteCtx, versionlessGVR)
		if err != nil {
			result.Kind = versionlessGVR.Resource // could not find a kind
			result.Error = fmt.Errorf("get client for deleted object: %w", err)
			progress.Record(deleteCtx, result)
			deleteSpan.End()
			return
		}
		result.Kind = gvk.Kind

		if err := client.Delete(deleteCtx, change.Existing.Name, metav1.DeleteOptions{}); err != nil {
			result.Error = fmt.Errorf("deleting resource %s/%s %s: %w", change.Existing.Group, gvk.Kind, change.Existing.Name, err)
		}
		progress.Record(deleteCtx, result)
		deleteSpan.End()
		return
	}

	// Handle folders based on action type
	if safepath.IsDir(change.Path) {
		// For non-deletions, ensure folder exists
		ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.ensure_folder_exists")
		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
			Group:  resources.FolderKind.Group,
			Kind:   resources.FolderKind.Kind,
		}

		folder, err := repositoryResources.EnsureFolderPathExist(ensureFolderCtx, change.Path)
		if err != nil {
			result.Error = fmt.Errorf("ensuring folder exists at path %s: %w", change.Path, err)
			ensureFolderSpan.RecordError(err)
			ensureFolderSpan.End()
			progress.Record(ctx, result)
			return
		}

		result.Name = folder
		progress.Record(ensureFolderCtx, result)
		ensureFolderSpan.End()
		return
	}

	writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.write_resource_from_file")
	name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, "")
	result := jobs.JobResourceResult{
		Path:   change.Path,
		Action: change.Action,
		Name:   name,
		Group:  gvk.Group,
		Kind:   gvk.Kind,
	}
	if err != nil {
		writeSpan.RecordError(err)
		result.Error = fmt.Errorf("writing resource from file %s: %w", change.Path, err)
	}

	progress.Record(writeCtx, result)
	writeSpan.End()
}

func applyChanges(ctx context.Context, changes []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, maxSyncWorkers int, metrics jobs.JobMetrics) error {
	progress.SetTotal(ctx, len(changes))

	_, applyChangesSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes",
		trace.WithAttributes(attribute.Int("changes_count", len(changes))),
	)
	defer applyChangesSpan.End()

	// Separate changes into four categories for proper ordering:
	// 1. File deletions (must happen before folder deletions)
	// 2. Folder deletions
	// 3. Folder creations (must happen before file creations)
	// 4. File creations (must happen after folder creations)
	var fileDeletions []ResourceFileChange
	var folderDeletions []ResourceFileChange
	var folderCreations []ResourceFileChange
	var fileCreations []ResourceFileChange

	for _, change := range changes {
		isFolder := safepath.IsDir(change.Path)
		isDeleted := change.Action == repository.FileActionDeleted

		if isDeleted {
			if isFolder {
				folderDeletions = append(folderDeletions, change)
			} else {
				fileDeletions = append(fileDeletions, change)
			}
		} else {
			if isFolder {
				folderCreations = append(folderCreations, change)
			} else {
				fileCreations = append(fileCreations, change)
			}
		}
	}

	applyChangesSpan.SetAttributes(
		attribute.Int("file_deletions", len(fileDeletions)),
		attribute.Int("folder_deletions", len(folderDeletions)),
		attribute.Int("folder_creations", len(folderCreations)),
		attribute.Int("file_creations", len(fileCreations)),
	)

	// instrument a function with a phase and metrics
	instrumented := func(phase jobs.FullSyncPhase, fn func() error) error {
		phaseStart := time.Now()
		err := fn()
		metrics.RecordFullSyncPhase(phase, time.Since(phaseStart))
		return err
	}

	if len(fileDeletions) > 0 {
		if err := instrumented(jobs.FullSyncPhaseFileDeletions, func() error {
			return applyResourcesInParallel(ctx, fileDeletions, clients, repositoryResources, progress, tracer, maxSyncWorkers)
		}); err != nil {
			return err
		}
	}

	if len(folderDeletions) > 0 {
		if err := instrumented(jobs.FullSyncPhaseFolderDeletions, func() error {
			return applyFoldersSerially(ctx, folderDeletions, clients, repositoryResources, progress, tracer)
		}); err != nil {
			return err
		}
	}

	if len(folderCreations) > 0 {
		if err := instrumented(jobs.FullSyncPhaseFolderCreations, func() error {
			return applyFoldersSerially(ctx, folderCreations, clients, repositoryResources, progress, tracer)
		}); err != nil {
			return err
		}
	}

	if len(fileCreations) > 0 {
		if err := instrumented(jobs.FullSyncPhaseFileCreations, func() error {
			return applyResourcesInParallel(ctx, fileCreations, clients, repositoryResources, progress, tracer, maxSyncWorkers)
		}); err != nil {
			return err
		}
	}

	return nil
}

func applyFoldersSerially(ctx context.Context, folders []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	logger := logging.FromContext(ctx)

	for _, folder := range folders {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		folderCtx, cancel := context.WithTimeout(ctx, 15*time.Second)

		applyChange(folderCtx, folder, clients, repositoryResources, progress, tracer)

		if folderCtx.Err() == context.DeadlineExceeded {
			logger.Error("operation timed out after 15 seconds", "path", folder.Path, "action", folder.Action)

			recordCtx, recordCancel := context.WithTimeout(context.Background(), 15*time.Second)
			progress.Record(recordCtx, jobs.JobResourceResult{
				Path:   folder.Path,
				Action: folder.Action,
				Error:  fmt.Errorf("operation timed out after 15 seconds"),
			})
			recordCancel()
		}

		cancel()
	}

	return nil
}

func applyResourcesInParallel(ctx context.Context, resources []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, maxSyncWorkers int) error {
	logger := logging.FromContext(ctx)
	logger.Info("applying resources in parallel test changes 1")

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

			applyChangeWithTimeout(ctx, change, clients, repositoryResources, progress, tracer, logger)
		}(change)
	}

	wg.Wait()

	if err := progress.TooManyErrors(); err != nil {
		return err
	}

	return ctx.Err()
}

func applyChangeWithTimeout(ctx context.Context, change ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer, logger logging.Logger) {
	changeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	applyChange(changeCtx, change, clients, repositoryResources, progress, tracer)

	if changeCtx.Err() == context.DeadlineExceeded {
		logger.Error("operation timed out after 15 seconds", "path", change.Path, "action", change.Action)

		recordCtx, recordCancel := context.WithTimeout(context.Background(), 15*time.Second)
		progress.Record(recordCtx, jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
			Error:  fmt.Errorf("operation timed out after 15 seconds"),
		})
		recordCancel()
	}
}

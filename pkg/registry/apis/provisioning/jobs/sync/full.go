package sync

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
) error {
	cfg := repo.Config()

	ctx, span := tracer.Start(ctx, "provisioning.sync.full")
	defer span.End()

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
	changes, err := compare(compareCtx, repo, repositoryResources, currentRef)
	if err != nil {
		compareSpan.End()
		return tracing.Error(span, fmt.Errorf("compare changes: %w", err))
	}
	compareSpan.End()

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	return applyChanges(ctx, changes, clients, repositoryResources, progress, tracer)
}

func processChange(ctx context.Context, change ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) {
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

func applyChanges(ctx context.Context, changes []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
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

	if len(fileDeletions) > 0 {
		if err := processResourcesInParallel(ctx, fileDeletions, clients, repositoryResources, progress, tracer); err != nil {
			return err
		}
	}

	if len(folderDeletions) > 0 {
		if err := processFoldersSerially(ctx, folderDeletions, clients, repositoryResources, progress, tracer); err != nil {
			return err
		}
	}

	if len(folderCreations) > 0 {
		if err := processFoldersSerially(ctx, folderCreations, clients, repositoryResources, progress, tracer); err != nil {
			return err
		}
	}

	if len(fileCreations) > 0 {
		return processResourcesInParallel(ctx, fileCreations, clients, repositoryResources, progress, tracer)
	}

	return nil
}

func processFoldersSerially(ctx context.Context, folders []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	folderCtx, folderCancel := context.WithCancel(ctx)
	defer folderCancel()

	for _, folder := range folders {
		if folderCtx.Err() != nil {
			return folderCtx.Err()
		}

		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		processChange(folderCtx, folder, clients, repositoryResources, progress, tracer)
	}

	return nil
}

func processResourcesInParallel(ctx context.Context, resources []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	if len(resources) == 0 {
		return nil
	}

	const maxWorkers = 10
	workerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	changeChan := make(chan ResourceFileChange, len(resources))
	var wg sync.WaitGroup

	for i := 0; i < maxWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case change, ok := <-changeChan:
					if !ok {
						return
					}

					if err := progress.TooManyErrors(); err != nil {
						cancel()
						return
					}
					if workerCtx.Err() != nil {
						return
					}

					processChange(workerCtx, change, clients, repositoryResources, progress, tracer)

				case <-workerCtx.Done():
					return
				}
			}
		}()
	}

	for _, change := range resources {
		select {
		case changeChan <- change:
		case <-workerCtx.Done():
			goto done
		}
	}
done:
	close(changeChan)
	wg.Wait()

	if err := progress.TooManyErrors(); err != nil {
		return err
	}

	return ctx.Err()
}

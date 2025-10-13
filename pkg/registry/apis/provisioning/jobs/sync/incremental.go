package sync

import (
	"context"
	"errors"
	"fmt"

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
func IncrementalSync(ctx context.Context, repo repository.Versioned, previousRef, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	if previousRef == currentRef {
		progress.SetFinalMessage(ctx, "same commit as last time")
		return nil
	}

	ctx, span := tracer.Start(ctx, "provisioning.sync.incremental")
	defer span.End()

	compareCtx, compareSpan := tracer.Start(ctx, "provisioning.sync.incremental.compare_files")
	diff, err := repo.CompareFiles(compareCtx, previousRef, currentRef)
	if err != nil {
		compareSpan.RecordError(err)
		compareSpan.End()
		return tracing.Error(span, fmt.Errorf("compare files error: %w", err))
	}
	compareSpan.End()

	if len(diff) < 1 {
		progress.SetFinalMessage(ctx, "no changes detected between commits")
		return nil
	}

	progress.SetTotal(ctx, len(diff))
	progress.SetMessage(ctx, "replicating versioned changes")

	// this will keep track of any folders that had resources deleted from it
	// with key-value as path:grafana uid.
	// after cleaning up all resources, we will look to see if the foldrs are
	// now empty, and if so, delete them.
	affectedFolders := make(map[string]string)
	for _, change := range diff {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := progress.TooManyErrors(); err != nil {
			return tracing.Error(span, err)
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
					return tracing.Error(span, fmt.Errorf("unable to create empty file folder: %w", err))
				}

				progress.Record(ensureFolderCtx, jobs.JobResourceResult{
					Path:   safeSegment,
					Action: repository.FileActionCreated,
					Group:  resources.FolderResource.Group,
					Kind:   resources.FolderKind.Kind,
					Name:   folder,
				})
				ensureFolderSpan.End()
				continue
			}

			progress.Record(ensureFolderCtx, jobs.JobResourceResult{
				Path:   change.Path,
				Action: repository.FileActionIgnored,
			})
			ensureFolderSpan.End()
			continue
		}

		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.incremental.write_resource_from_file")
			name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, change.Ref)
			if err != nil {
				writeSpan.RecordError(err)
				result.Error = fmt.Errorf("writing resource from file %s: %w", change.Path, err)
			}
			result.Name = name
			result.Kind = gvk.Kind
			result.Group = gvk.Group
			writeSpan.End()
		case repository.FileActionDeleted:
			removeCtx, removeSpan := tracer.Start(ctx, "provisioning.sync.incremental.remove_resource_from_file")
			name, folderName, gvk, err := repositoryResources.RemoveResourceFromFile(removeCtx, change.Path, change.PreviousRef)
			if err != nil {
				removeSpan.RecordError(err)
				result.Error = fmt.Errorf("removing resource from file %s: %w", change.Path, err)
			}
			result.Name = name
			result.Kind = gvk.Kind
			result.Group = gvk.Group

			if folderName != "" {
				affectedFolders[safepath.Dir(change.Path)] = folderName
			}

			removeSpan.End()
		case repository.FileActionRenamed:
			renameCtx, renameSpan := tracer.Start(ctx, "provisioning.sync.incremental.rename_resource_file")
			name, oldFolderName, gvk, err := repositoryResources.RenameResourceFile(renameCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref)
			if err != nil {
				renameSpan.RecordError(err)
				result.Error = fmt.Errorf("renaming resource file from %s to %s: %w", change.PreviousPath, change.Path, err)
			}
			result.Name = name
			result.Kind = gvk.Kind
			result.Group = gvk.Group

			if oldFolderName != "" {
				affectedFolders[safepath.Dir(change.Path)] = oldFolderName
			}

			renameSpan.End()
		case repository.FileActionIgnored:
			// do nothing
		}
		progress.Record(ctx, result)
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	if len(affectedFolders) > 0 {
		span.AddEvent("checking if impacted folders should be deleted", trace.WithAttributes(attribute.Int("affected_folders", len(affectedFolders))))
		if err := cleanupOrphanedFolders(ctx, repo, affectedFolders, repositoryResources, tracer); err != nil {
			return tracing.Error(span, fmt.Errorf("cleanup orphaned folders: %w", err))
		}
	}

	return nil
}

// cleanupOrphanedFolders removes folders that no longer contain any resources in git after deletions have occurred.
func cleanupOrphanedFolders(
	ctx context.Context,
	repo repository.Versioned,
	affectedFolders map[string]string,
	repositoryResources resources.RepositoryResources,
	tracer tracing.Tracer,
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

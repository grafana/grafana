package sync

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
					Path:     safeSegment,
					Action:   repository.FileActionCreated,
					Resource: resources.FolderResource.Resource,
					Group:    resources.FolderResource.Group,
					Name:     folder,
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
			result.Resource = gvk.Kind
			result.Group = gvk.Group
			writeSpan.End()
		case repository.FileActionDeleted:
			removeCtx, removeSpan := tracer.Start(ctx, "provisioning.sync.incremental.remove_resource_from_file")
			name, gvk, err := repositoryResources.RemoveResourceFromFile(removeCtx, change.Path, change.PreviousRef)
			if err != nil {
				removeSpan.RecordError(err)
				result.Error = fmt.Errorf("removing resource from file %s: %w", change.Path, err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
			removeSpan.End()
		case repository.FileActionRenamed:
			renameCtx, renameSpan := tracer.Start(ctx, "provisioning.sync.incremental.rename_resource_file")
			name, gvk, err := repositoryResources.RenameResourceFile(renameCtx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref)
			if err != nil {
				renameSpan.RecordError(err)
				result.Error = fmt.Errorf("renaming resource file from %s to %s: %w", change.PreviousPath, change.Path, err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
			renameSpan.End()
		case repository.FileActionIgnored:
			// do nothing
		}
		progress.Record(ctx, result)
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	return nil
}

package sync

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// Convert git changes into resource file changes
func IncrementalSync(ctx context.Context, repo repository.Versioned, previousRef, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	if previousRef == currentRef {
		progress.SetFinalMessage(ctx, "same commit as last time")
		return nil
	}

	diff, err := repo.CompareFiles(ctx, previousRef, currentRef)
	if err != nil {
		return fmt.Errorf("compare files error: %w", err)
	}

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
			return err
		}

		if err := resources.IsPathSupported(change.Path); err != nil {
			// Maintain the safe segment for empty folders
			safeSegment := safepath.SafeSegment(change.Path)
			if !safepath.IsDir(safeSegment) {
				safeSegment = safepath.Dir(safeSegment)
			}

			if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
				folder, err := repositoryResources.EnsureFolderPathExist(ctx, safeSegment)
				if err != nil {
					return fmt.Errorf("unable to create empty file folder: %w", err)
				}

				progress.Record(ctx, jobs.JobResourceResult{
					Path:     safeSegment,
					Action:   repository.FileActionCreated,
					Resource: resources.FolderResource.Resource,
					Group:    resources.FolderResource.Group,
					Name:     folder,
				})

				continue
			}

			progress.Record(ctx, jobs.JobResourceResult{
				Path:   change.Path,
				Action: repository.FileActionIgnored,
			})
			continue
		}

		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			name, gvk, err := repositoryResources.WriteResourceFromFile(ctx, change.Path, change.Ref)
			if err != nil {
				result.Error = fmt.Errorf("writing resource from file %s: %w", change.Path, err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionDeleted:
			name, gvk, err := repositoryResources.RemoveResourceFromFile(ctx, change.Path, change.PreviousRef)
			if err != nil {
				result.Error = fmt.Errorf("removing resource from file %s: %w", change.Path, err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionRenamed:
			name, gvk, err := repositoryResources.RenameResourceFile(ctx, change.PreviousPath, change.PreviousRef, change.Path, change.Ref)
			if err != nil {
				result.Error = fmt.Errorf("renaming resource file from %s to %s: %w", change.PreviousPath, change.Path, err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionIgnored:
			// do nothing
		}
		progress.Record(ctx, result)
	}

	progress.SetMessage(ctx, "versioned changes replicated")

	return nil
}

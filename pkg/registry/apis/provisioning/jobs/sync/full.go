package sync

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func FullSync(
	ctx context.Context,
	repo repository.Reader,
	clients resources.ResourceClients,
	currentRef string,
	// TODO: put folders behind RepositoryResources
	folders *resources.FolderManager,
	resourceManager *resources.ResourcesManager,
	// TODO: put lister behind RepositoryResources
	lister resources.ResourceLister,
	progress jobs.JobProgressRecorder,
) error {
	cfg := repo.Config()
	target, err := lister.List(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		return fmt.Errorf("error listing current: %w", err)
	}
	source, err := repo.ReadTree(ctx, currentRef)
	if err != nil {
		return fmt.Errorf("error reading tree: %w", err)
	}
	changes, err := Changes(source, target)
	if err != nil {
		return fmt.Errorf("error calculating changes: %w", err)
	}

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	folders.SetTree(resources.NewFolderTreeFromResourceList(target))

	return ApplyChanges(ctx, changes, clients, folders, resourceManager, progress)
}

func ApplyChanges(ctx context.Context, changes []ResourceFileChange, clients resources.ResourceClients, folders *resources.FolderManager, resourceManager *resources.ResourcesManager, progress jobs.JobProgressRecorder) error {
	progress.SetTotal(ctx, len(changes))
	progress.SetMessage(ctx, "replicating changes")

	for _, change := range changes {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		if change.Action == repository.FileActionDeleted {
			result := jobs.JobResourceResult{
				Name:     change.Existing.Name,
				Resource: change.Existing.Resource,
				Group:    change.Existing.Group,
				Path:     change.Path,
				Action:   change.Action,
			}

			if change.Existing == nil || change.Existing.Name == "" {
				result.Error = errors.New("missing existing reference")
				progress.Record(ctx, result)
				continue
			}

			versionlessGVR := schema.GroupVersionResource{
				Group:    change.Existing.Group,
				Resource: change.Existing.Resource,
			}

			// TODO: should we use the clients or the resource manager instead?
			client, _, err := clients.ForResource(versionlessGVR)
			if err != nil {
				result.Error = fmt.Errorf("unable to get client for deleted object: %w", err)
				progress.Record(ctx, result)
				continue
			}

			result.Error = client.Delete(ctx, change.Existing.Name, metav1.DeleteOptions{})
			progress.Record(ctx, result)
			continue
		}

		// If folder ensure it exists
		if safepath.IsDir(change.Path) {
			result := jobs.JobResourceResult{
				Path:   change.Path,
				Action: change.Action,
			}

			folder, err := folders.EnsureFolderPathExist(ctx, change.Path)
			if err != nil {
				result.Error = fmt.Errorf("create folder: %w", err)
				progress.Record(ctx, result)
				continue
			}

			result.Name = folder
			result.Resource = resources.FolderResource.Resource
			result.Group = resources.FolderResource.Group
			progress.Record(ctx, result)

			continue
		}

		name, gvk, err := resourceManager.WriteResourceFromFile(ctx, change.Path, "")
		result := jobs.JobResourceResult{
			Path:     change.Path,
			Action:   change.Action,
			Name:     name,
			Error:    err,
			Resource: gvk.Kind,
			Group:    gvk.Group,
		}
		progress.Record(ctx, result)
	}

	progress.SetMessage(ctx, "changes replicated")

	return nil
}

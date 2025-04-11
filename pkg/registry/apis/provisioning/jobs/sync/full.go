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
	compare CompareFn,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	cfg := repo.Config()

	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := repositoryResources.EnsureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			return fmt.Errorf("create root folder: %w", err)
		}
	}

	changes, err := compare(ctx, repo, repositoryResources, currentRef)
	if err != nil {
		return fmt.Errorf("compare changes: %w", err)
	}

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	return applyChanges(ctx, changes, clients, repositoryResources, progress)
}

func applyChanges(ctx context.Context, changes []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetTotal(ctx, len(changes))

	for _, change := range changes {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		if change.Action == repository.FileActionDeleted {
			result := jobs.JobResourceResult{
				Path:   change.Path,
				Action: change.Action,
			}

			if change.Existing == nil || change.Existing.Name == "" {
				result.Error = errors.New("missing existing reference")
				progress.Record(ctx, result)
				continue
			}

			result.Name = change.Existing.Name
			result.Resource = change.Existing.Resource
			result.Group = change.Existing.Group

			versionlessGVR := schema.GroupVersionResource{
				Group:    change.Existing.Group,
				Resource: change.Existing.Resource,
			}

			// TODO: should we use the clients or the resource manager instead?
			client, _, err := clients.ForResource(versionlessGVR)
			if err != nil {
				result.Error = fmt.Errorf("get client for deleted object: %w", err)
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
				Path:     change.Path,
				Action:   change.Action,
				Resource: resources.FolderResource.Resource,
				Group:    resources.FolderResource.Group,
			}

			folder, err := repositoryResources.EnsureFolderPathExist(ctx, change.Path)
			if err != nil {
				result.Error = err
				progress.Record(ctx, result)
				continue
			}

			result.Name = folder
			progress.Record(ctx, result)

			continue
		}

		name, gvk, err := repositoryResources.WriteResourceFromFile(ctx, change.Path, "")
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

	return nil
}

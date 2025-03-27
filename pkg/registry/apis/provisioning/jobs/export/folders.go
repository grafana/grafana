package export

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func (r *exportJob) exportFoldersFromAPIServer(ctx context.Context) error {
	// FIXME: we load the entire tree in memory
	r.progress.SetMessage(ctx, "reading folder tree from unified storage")
	repoName := r.target.Config().Name
	err := r.client.ForEachFolder(ctx, func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error {
		// TODO: should we stop execution if this fails?
		err := r.folderTree.AddUnstructured(item, repoName)
		if err != nil {
			r.progress.Record(ctx, jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: item.GroupVersionKind().Kind,
				Group:    item.GroupVersionKind().Group,
				Error:    err,
			})
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("read folders in memory to build tree: %w", err)
	}

	r.progress.SetMessage(ctx, "write folders to repository")

	client, err := r.client.Folder()
	if err != nil {
		return fmt.Errorf("failed to get folder client: %w", err)
	}

	folders := resources.NewFolderManager(r.target, client, resources.NewEmptyFolderTree())
	err = folders.ReplicateTree(ctx, r.folderTree, r.ref, r.path, func(folder resources.Folder, created bool, err error) error {
		result := jobs.JobResourceResult{
			Action:   repository.FileActionCreated,
			Name:     folder.ID,
			Resource: resources.FolderResource.Resource,
			Group:    resources.FolderResource.Group,
			Path:     folder.Path,
			Error:    err,
		}

		if !created {
			result.Action = repository.FileActionIgnored
		}

		r.progress.Record(ctx, result)
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}

	return nil
}

package export

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// LoadExportableFolderTree builds a FolderTree containing only unmanaged folders
func LoadExportableFolderTree(ctx context.Context, folderClient dynamic.ResourceInterface) (resources.FolderTree, error) {
	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}

		manager, _ := meta.GetManagerProperties()
		// Skip if already managed by any manager (repository, file provisioning, etc.)
		if manager.Identity != "" {
			return nil
		}

		return tree.AddUnstructured(item)
	}); err != nil {
		return nil, fmt.Errorf("load folder tree: %w", err)
	}
	return tree, nil
}

// ExportFolders will load the full folder tree into memory and update the repositoryResources tree
func ExportFolders(ctx context.Context, repoName string, options provisioning.ExportJobOptions, folderClient dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	// Load and write all folders
	// FIXME: we load the entire tree in memory
	progress.SetMessage(ctx, "read folder tree from API server")

	tree, err := LoadExportableFolderTree(ctx, folderClient)
	if err != nil {
		return err
	}

	return ExportFoldersFromTree(ctx, options, tree, repositoryResources, progress)
}

// ExportFoldersFromTree writes a pre-built folder tree to the repository.
// Use this when the tree has already been loaded (e.g. after counting for quota checks).
func ExportFoldersFromTree(ctx context.Context, options provisioning.ExportJobOptions, tree resources.FolderTree, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "write folders to repository")
	err := repositoryResources.EnsureFolderTreeExists(ctx, options.Branch, options.Path, tree, func(folder resources.Folder, created bool, err error) error {
		resultBuilder := jobs.NewFolderResult(folder.Path).WithName(folder.ID).WithAction(repository.FileActionCreated)

		if err != nil {
			resultBuilder.WithError(fmt.Errorf("creating folder %s at path %s: %w", folder.ID, folder.Path, err))
		}

		if !created {
			resultBuilder.WithAction(repository.FileActionIgnored)
		}
		progress.Record(ctx, resultBuilder.Build())
		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("write folders to repository: %w", err)
	}

	return nil
}

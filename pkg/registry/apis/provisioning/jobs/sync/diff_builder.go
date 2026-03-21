package sync

import (
	"context"
	"errors"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

//go:generate mockery --name FolderMetadataIncrementalDiffBuilder --structname MockFolderMetadataIncrementalDiffBuilder --inpackage --filename incremental_diff_builder_mock.go --with-expecter
type FolderMetadataIncrementalDiffBuilder interface {
	BuildIncrementalDiff(
		ctx context.Context,
		repoDiff []repository.VersionedFileChange,
	) ([]repository.VersionedFileChange, error)
}

type repoDiffBuilder struct {
	repo                repository.Reader
	repositoryResources resources.RepositoryResources
}

type replacedFolder struct {
	Path   string
	OldUID string
}

func NewDiffBuilder(
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
) *repoDiffBuilder {
	return &repoDiffBuilder{
		repo:                repo,
		repositoryResources: repositoryResources,
	}
}

// BuildIncrementalDiff rewrites handled _folder.json create/update events into
// synthetic folder changes plus direct-child updates.
//
// The builder keeps all unrelated git changes intact, suppresses duplicate
// synthetic paths that are already present in the real diff, and returns the
// old folder UIDs that must be deleted after the rewritten diff is applied.
func (d *repoDiffBuilder) BuildIncrementalDiff(
	ctx context.Context,
	repoDiff []repository.VersionedFileChange,
) ([]repository.VersionedFileChange, []replacedFolder, error) {
	var filteredDiff []repository.VersionedFileChange
	metadataUpdates := make(map[string]repository.VersionedFileChange)
	// pathWithChanges contains paths that already have changes in the current diff
	// This is used to skip adding double changes for the same path
	pathWithChanges := make(map[string]struct{})
	for _, change := range repoDiff {
		// Collect all metadata updates for adding new folder changes.
		if resources.IsFolderMetadataFile(change.Path) && (change.Action == repository.FileActionCreated ||
			change.Action == repository.FileActionUpdated) {
			metadataUpdates[change.Path] = change
			continue
		}

		// If the change is not related to metadata, add it to the result diff
		filteredDiff = append(filteredDiff, change)

		if safepath.IsDir(change.Path) {
			pathWithChanges[safepath.EnsureTrailingSlash(change.Path)] = struct{}{}
		} else {
			pathWithChanges[change.Path] = struct{}{}
		}
		if change.Action == repository.FileActionRenamed {
			if safepath.IsDir(change.PreviousPath) {
				pathWithChanges[safepath.EnsureTrailingSlash(change.PreviousPath)] = struct{}{}
			} else {
				pathWithChanges[change.PreviousPath] = struct{}{}
			}
		}
	}
	// No metadata updates, return the current diff unchanged.
	if len(metadataUpdates) == 0 {
		return repoDiff, nil, nil
	}

	target, err := d.repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("list managed resources: %w", err)
	}

	var replacedFolders []replacedFolder
	resourcesLookup := buildResourcesLookup(target)

	for _, update := range metadataUpdates {
		parentPath := safepath.EnsureTrailingSlash(safepath.Dir(update.Path))
		if _, ok := pathWithChanges[parentPath]; !ok {
			filteredDiff = append(filteredDiff, repository.VersionedFileChange{
				Action: update.Action,
				Path:   parentPath,
				Ref:    update.Ref,
			})
			replaced, err := d.replacedFolderForMetadataUpdate(ctx, resourcesLookup, parentPath, update)
			if err != nil {
				return nil, nil, err
			}
			if replaced != nil {
				replacedFolders = append(replacedFolders, *replaced)
			}

			childrenPaths := getChildrenPaths(resourcesLookup, parentPath)
			for _, childPath := range childrenPaths {
				if _, ok := pathWithChanges[childPath]; !ok {
					filteredDiff = append(filteredDiff, repository.VersionedFileChange{
						Action: repository.FileActionUpdated,
						Path:   childPath,
						Ref:    update.Ref,
					})
					pathWithChanges[childPath] = struct{}{}
				}
			}
		}
	}

	return filteredDiff, replacedFolders, nil
}

// replacedFolderForMetadataUpdate determines whether a metadata change at a
// folder path actually replaces the current folder identity.
//
// A folder is only marked for later deletion when the managed folder already
// exists at that path and the UID resolved from the new _folder.json differs
// from the existing folder UID.
func (d *repoDiffBuilder) replacedFolderForMetadataUpdate(
	ctx context.Context,
	resourcesLookup map[string]*provisioning.ResourceListItem,
	parentPath string,
	update repository.VersionedFileChange,
) (*replacedFolder, error) {
	existing := resourcesLookup[parentPath]
	if existing == nil {
		return nil, nil
	}

	folder, _, err := resources.ReadFolderMetadata(ctx, d.repo, parentPath, update.Ref)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read folder metadata for %s: %w", parentPath, err)
	}
	if folder.GetName() == existing.Name {
		return nil, nil
	}

	return &replacedFolder{
		Path:   parentPath,
		OldUID: existing.Name,
	}, nil
}

// buildResourcesLookup indexes all managed resources by path so planning can
// emit synthetic direct-child updates only for resources that already exist in Grafana.
func buildResourcesLookup(target *provisioning.ResourceList) map[string]*provisioning.ResourceListItem {
	resourcesLookup := make(map[string]*provisioning.ResourceListItem)
	if target == nil {
		return resourcesLookup
	}

	for i := range target.Items {
		item := &target.Items[i]
		path := item.Path
		if item.Group == resources.FolderResource.Group {
			path = safepath.EnsureTrailingSlash(path)
		}
		resourcesLookup[path] = item
	}

	return resourcesLookup
}

// getChildrenPaths returns the managed paths that are direct children of the
// given folder path, excluding deeper descendants.
func getChildrenPaths(
	resourcesLookup map[string]*provisioning.ResourceListItem,
	parentPath string,
) []string {
	childrenPaths := make([]string, 0)
	for path := range resourcesLookup {
		if safepath.EnsureTrailingSlash(safepath.Dir(path)) == parentPath {
			childrenPaths = append(childrenPaths, path)
		}
	}
	return childrenPaths
}

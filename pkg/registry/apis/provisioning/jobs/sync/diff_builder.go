package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name FolderMetadataIncrementalDiffBuilder --structname MockFolderMetadataIncrementalDiffBuilder --inpackage --filename incremental_diff_builder_mock.go --with-expecter
type FolderMetadataIncrementalDiffBuilder interface {
	BuildIncrementalDiff(
		ctx context.Context,
		repoDiff []repository.VersionedFileChange,
	) ([]repository.VersionedFileChange, error)
}

type repoDiffBuilder struct {
	repo repository.Reader
	repositoryResources resources.RepositoryResources
}

type replacedFolderRewritten struct {
	Path   string
	OldUID string
}

func NewDiffBuilder(
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
) *repoDiffBuilder {
	return &repoDiffBuilder{
		repo: repo,	
		repositoryResources: repositoryResources,
	}
}

func (d *repoDiffBuilder) BuildIncrementalDiff(
	ctx context.Context,
	repoDiff []repository.VersionedFileChange,
) ([]repository.VersionedFileChange, []replacedFolderRewritten, error) {
	var filteredDiff []repository.VersionedFileChange
	metadataUpdates := make(map[string]repository.VersionedFileChange)
	// pathWithChanges contains paths that already have changes in the current diff
	// This is used to skip adding double changes for the same path
	pathWithChanges := make(map[string]struct{})
	for _, change := range repoDiff {
		// Collect all metadata updates for adding new folder changes.
		if resources.IsFolderMetadataFile(change.Path) && (
			change.Action == repository.FileActionCreated ||
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

	var replacedFolders []replacedFolderRewritten
	resourcesLookup := buildResourcesLookup(target)

	for _, update := range metadataUpdates {
		parentPath := safepath.EnsureTrailingSlash(safepath.Dir(update.Path))
		if _, ok := pathWithChanges[parentPath]; !ok {
			filteredDiff = append(filteredDiff, repository.VersionedFileChange{
				Action: update.Action,
				Path:   parentPath,
				Ref:    update.Ref,
			})
			if resourcesLookup[parentPath] != nil {
				replacedFolders = append(replacedFolders, replacedFolderRewritten{
					Path:   parentPath,
					OldUID: resourcesLookup[parentPath].Name,
				})
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

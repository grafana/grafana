package sync

import (
	"context"
	"fmt"
	"sort"
	"strings"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type ResourceFileChange struct {
	// Path to the file in a repository with a change
	Path   string
	Action repository.FileAction

	// The current value in the database -- only required for delete
	Existing *provisioning.ResourceListItem
}

func Compare(ctx context.Context, repo repository.Reader, repositoryResources resources.RepositoryResources, ref string) ([]ResourceFileChange, error) {
	target, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("error listing current: %w", err)
	}

	source, err := repo.ReadTree(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("error reading tree: %w", err)
	}

	changes, err := Changes(source, target)
	if err != nil {
		return nil, fmt.Errorf("calculate changes: %w", err)
	}

	if len(changes) > 0 {
		// FIXME: this is a way to load in different ways the resources
		// maybe we can structure the code in better way to avoid this
		repositoryResources.SetTree(resources.NewFolderTreeFromResourceList(target))
	}

	return changes, nil
}

func Changes(source []repository.FileTreeEntry, target *provisioning.ResourceList) ([]ResourceFileChange, error) {
	lookup := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	for _, item := range target.Items {
		if item.Path == "" {
			if item.Group != resources.FolderResource.Group {
				return nil, fmt.Errorf("empty path on a non folder")
			}
			continue
		}

		// TODO: why do we have to do this here?
		if item.Group == resources.FolderResource.Group && !strings.HasSuffix(item.Path, "/") {
			item.Path = item.Path + "/"
		}

		lookup[item.Path] = &item
	}

	keep := safepath.NewTrie()
	changes := make([]ResourceFileChange, 0, len(source))
	for _, file := range source {
		// TODO: why do we have to do this here?
		if !file.Blob && !strings.HasSuffix(file.Path, "/") {
			file.Path = file.Path + "/"
		}

		check, ok := lookup[file.Path]
		if ok {
			if check.Hash != file.Hash && check.Resource != resources.FolderResource.Resource {
				changes = append(changes, ResourceFileChange{
					Action:   repository.FileActionUpdated,
					Path:     check.Path,
					Existing: check,
				})
			}

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			if check.Resource != resources.FolderResource.Resource {
				delete(lookup, file.Path)
			}

			continue
		}

		if resources.IsPathSupported(file.Path) == nil {
			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated, // or previously ignored/failed
				Path:   file.Path,
			})

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			continue
		}

		// Maintain the safe segment for empty folders
		safeSegment := safepath.SafeSegment(file.Path)
		if !safepath.IsDir(safeSegment) {
			safeSegment = safepath.Dir(safeSegment)
		}

		if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
			if err := keep.Add(safeSegment); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			_, ok := lookup[safeSegment]
			if ok {
				continue
			}

			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated, // or previously ignored/failed
				Path:   safeSegment,
			})
		}
	}

	// Paths found in grafana, without a matching path in the repository
	for _, v := range lookup {
		if v.Resource == resources.FolderResource.Resource && keep.Exists(v.Path) {
			continue
		}

		changes = append(changes, ResourceFileChange{
			Action:   repository.FileActionDeleted,
			Path:     v.Path,
			Existing: v,
		})
	}

	// Deepest first (stable sort order)
	sort.Slice(changes, func(i, j int) bool {
		if safepath.Depth(changes[i].Path) > safepath.Depth(changes[j].Path) {
			return true
		}

		if safepath.Depth(changes[i].Path) < safepath.Depth(changes[j].Path) {
			return false
		}

		return changes[i].Path < changes[j].Path
	})

	return changes, nil
}

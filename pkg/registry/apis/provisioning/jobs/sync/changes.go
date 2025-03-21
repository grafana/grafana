package sync

import (
	"fmt"
	"sort"

	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
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

func Changes(source []repository.FileTreeEntry, target *provisioning.ResourceList) ([]ResourceFileChange, error) {
	lookup := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	for _, item := range target.Items {
		if item.Path == "" {
			if item.Group != folders.GROUP {
				return nil, fmt.Errorf("empty path on a non folder")
			}
			continue
		}
		lookup[item.Path] = &item
	}

	keep := safepath.NewTrie()
	changes := make([]ResourceFileChange, 0, len(source))
	for _, file := range source {
		if !file.Blob {
			continue // skip folder references?
		}

		check, ok := lookup[file.Path]
		if ok {
			if check.Hash != file.Hash {
				changes = append(changes, ResourceFileChange{
					Action:   repository.FileActionUpdated,
					Path:     check.Path,
					Existing: check,
				})
			}

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			delete(lookup, file.Path)
			continue
		}

		// TODO: does this work with empty folders?
		if resources.IsPathSupported(file.Path) == nil {
			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated, // or previously ignored/failed
				Path:   file.Path,
			})
		}
	}

	// Paths found in grafana, without a matching path in the repository
	for _, v := range lookup {
		if v.Resource == folders.RESOURCE && keep.Exists(v.Path) {
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
		return safepath.Depth(changes[i].Path) > safepath.Depth(changes[j].Path)
	})

	return changes, nil
}

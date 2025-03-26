package sync

import (
	"fmt"
	"sort"
	"strings"

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

		// TODO: why do we have to do this here?
		if item.Group == folders.GROUP && !strings.HasSuffix(item.Path, "/") {
			item.Path = item.Path + "/"
		}

		lookup[item.Path] = &item
	}

	keep := safepath.NewTrie()
	changes := make([]ResourceFileChange, 0, len(source))
	for _, file := range source {
		check, ok := lookup[file.Path]
		if ok {
			if check.Hash != file.Hash && check.Resource != folders.RESOURCE {
				changes = append(changes, ResourceFileChange{
					Action:   repository.FileActionUpdated,
					Path:     check.Path,
					Existing: check,
				})
			}

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			if check.Resource != folders.RESOURCE {
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

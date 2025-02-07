package sync

import (
	"fmt"
	"sort"
	"strings"

	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

	var keep []string
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
			keep = append(keep, file.Path)
			delete(lookup, file.Path)
			continue
		}

		if !resources.ShouldIgnorePath(file.Path) {
			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated, // or previously ignored/failed
				Path:   file.Path,
			})
		}
	}

	// nested nested loop :grimmice: trie?
	hasFolder := func(p string) bool {
		for _, k := range keep {
			if strings.HasPrefix(k, p) {
				return true
			}
		}
		return false
	}

	// Paths found in grafana, without a matching path in the repository
	for _, v := range lookup {
		if v.Resource == folders.RESOURCE && hasFolder(v.Path) {
			continue
		}

		changes = append(changes, ResourceFileChange{
			Action:   repository.FileActionDeleted,
			Path:     v.Path,
			Existing: v,
		})
	}

	// Longest first (stable sort order)
	sort.Slice(changes, func(i, j int) bool {
		return len(changes[i].Path) > len(changes[j].Path)
	})

	return changes, nil
}

package jobs

import (
	"fmt"
	"sort"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ResourceFileChange struct {
	// Path to the file in a repository with a change
	Path   string
	Action provisioning.FileAction

	// The current value in the database -- only required for delete
	Existing *provisioning.ResourceListItem
}

func Changes(source []repository.FileTreeEntry, target *provisioning.ResourceList) ([]ResourceFileChange, error) {
	lookup := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	for _, item := range target.Items {
		if item.Path == "" {
			if item.Group != "folder.grafana.app" {
				return nil, fmt.Errorf("empty path on a non folder")
			}
			continue
		}
		lookup[item.Path] = &item
	}

	changes := make([]ResourceFileChange, 0, len(source))
	for _, file := range source {
		if !file.Blob {
			continue // skip folder references?
		}

		check, ok := lookup[file.Path]
		if ok {
			if check.Hash != file.Hash {
				changes = append(changes, ResourceFileChange{
					Action:   provisioning.FileActionUpdated,
					Path:     check.Path,
					Existing: check,
				})
			}
			delete(lookup, file.Path)
		} else if !resources.ShouldIgnorePath(file.Path) {
			changes = append(changes, ResourceFileChange{
				Action: provisioning.FileActionCreated, // or previously ignored/failed
				Path:   file.Path,
			})
		}
	}

	// File that were previously added, but are not in the current list
	for _, v := range lookup {
		changes = append(changes, ResourceFileChange{
			Action:   provisioning.FileActionDeleted,
			Path:     v.Path,
			Existing: v,
		})
	}

	// Do longest paths first (important for delete, irrelevant otherwise)
	sort.Slice(changes, func(i, j int) bool {
		return len(changes[i].Path) > len(changes[j].Path)
	})

	return changes, nil
}

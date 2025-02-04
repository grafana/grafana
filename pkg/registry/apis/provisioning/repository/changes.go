package repository

import (
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func Changes(source []FileTreeEntry, target *provisioning.ResourceList) ([]FileChange, error) {
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

	changes := make([]FileChange, 0, len(source))
	for _, file := range source {
		if !file.Blob {
			continue // skip folder references?
		}

		check, ok := lookup[file.Path]
		if ok {
			if check.Hash != file.Hash {
				changes = append(changes, FileChange{
					Action: FileActionUpdated,
					Path:   check.Path,
					DB:     check,

					Ref: file.Hash,
				})
			}
			delete(lookup, file.Path)
		} else {
			changes = append(changes, FileChange{
				Action: FileActionCreated, // or previously ignored/failed
				Path:   file.Path,
				Ref:    file.Hash,
			})
		}
	}

	// File that were previously added, but are not in the current list
	for _, v := range lookup {
		changes = append(changes, FileChange{
			Path:   v.Path,
			Action: FileActionDeleted,
			DB:     v,
		})
	}

	return changes, nil
}

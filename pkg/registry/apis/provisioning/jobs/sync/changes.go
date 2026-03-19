package sync

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ResourceFileChange struct {
	// Path to the file in a repository with a change
	Path   string
	Action repository.FileAction

	// The current value in the database -- only required for delete
	Existing *provisioning.ResourceListItem
}

// Compare reads the repository tree at ref, lists the current Grafana resources,
// and delegates to Changes to produce the diff. It also returns the list of
// folder paths that are missing a _folder.json metadata file.
func Compare(ctx context.Context, repo repository.Reader, repositoryResources resources.RepositoryResources, ref string) ([]ResourceFileChange, []string, error) {
	target, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("error listing current: %w", err)
	}

	source, err := repo.ReadTree(ctx, ref)
	if err != nil {
		return nil, nil, fmt.Errorf("error reading tree: %w", err)
	}

	changes, err := Changes(ctx, source, target)
	if err != nil {
		return nil, nil, fmt.Errorf("calculate changes: %w", err)
	}

	if len(changes) > 0 {
		// FIXME: this is a way to load in different ways the resources
		// maybe we can structure the code in better way to avoid this
		repositoryResources.SetTree(resources.NewFolderTreeFromResourceList(target))
	}

	missingMetadata := resources.FindFoldersMissingMetadata(source)

	return changes, missingMetadata, nil
}

// Changes computes the diff between a repository source tree and the current Grafana state (target).
//
//nolint:gocyclo
func Changes(ctx context.Context, source []repository.FileTreeEntry, target *provisioning.ResourceList) ([]ResourceFileChange, error) {
	logger := logging.FromContext(ctx)
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
			// The folder metadata file is not a resource itself.
			// For new folders the parent directory creation handles it;
			// for existing folders we compare hashes to detect metadata changes.
			if resources.IsFolderMetadataFile(file.Path) {
				logger.Debug("processing folder metadata file", "path", file.Path)
				if err := keep.Add(file.Path); err != nil {
					return nil, fmt.Errorf("failed to add path to keep folder metadata file: %w", err)
				}
				// If the parent directory already exists in Grafana and the hash changed,
				// record an update to reconcile metadata (e.g. folder title).
				parentDir := safepath.Dir(file.Path)
				if !strings.HasSuffix(parentDir, "/") {
					parentDir += "/"
				}
				if existing, ok := lookup[parentDir]; ok && existing.Hash != file.Hash {
					changes = append(changes, ResourceFileChange{
						Action:   repository.FileActionUpdated,
						Path:     parentDir,
						Existing: existing,
					})
				}
				continue
			}

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

			// Ignore file change for `.keep` folders
			if strings.HasSuffix(file.Path, ".keep") {
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
	safepath.SortByDepth(changes, func(c ResourceFileChange) string { return c.Path }, false)

	return changes, nil
}

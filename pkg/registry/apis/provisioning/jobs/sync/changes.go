package sync

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type ResourceFileChange struct {
	// Path to the file in a repository with a change
	Path   string
	Action repository.FileAction

	// The current value in the database -- only required for delete
	Existing *provisioning.ResourceListItem

	// FolderRenamed is set when a folder's _folder.json UID changed.
	// The old folder needs cleanup after all children have been re-parented.
	FolderRenamed bool
}

// IsUpdatedFolder reports whether this change is an update to an existing folder.
func (c *ResourceFileChange) IsUpdatedFolder() bool {
	return c.Action == repository.FileActionUpdated &&
		safepath.IsDir(c.Path) &&
		c.Existing != nil
}

// Compare reads the repository tree at ref, lists the current Grafana resources,
// and delegates to Changes to produce the diff. It also returns the list of
// folder paths that are missing a _folder.json metadata file.
func Compare(
	ctx context.Context,
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
	ref string,
	folderMetadataEnabled bool,
) ([]ResourceFileChange, []string, error) {
	target, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("error listing current: %w", err)
	}

	source, err := repo.ReadTree(ctx, ref)
	if err != nil {
		return nil, nil, fmt.Errorf("error reading tree: %w", err)
	}

	changes, err := Changes(ctx, source, target, folderMetadataEnabled)
	if err != nil {
		return nil, nil, fmt.Errorf("calculate changes: %w", err)
	}

	if folderMetadataEnabled {
		changes, err = augmentChangesForUIDChanges(ctx, repo, ref, source, target, changes)
		if err != nil {
			return nil, nil, fmt.Errorf("augment changes for UID changes: %w", err)
		}
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
func Changes(
	ctx context.Context,
	source []repository.FileTreeEntry,
	target *provisioning.ResourceList,
	folderMetadataEnabled bool,
) ([]ResourceFileChange, error) {
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
				if !folderMetadataEnabled {
					logger.Debug("skipping folder metadata file - will be handled by parent directory change", "path", file.Path)
					if err := keep.Add(file.Path); err != nil {
						return nil, fmt.Errorf("failed to add path to keep folder metadata file: %w", err)
					}
					continue
				}

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

// augmentChangesForUIDChanges detects folder UID changes (new _folder.json metadata.name
// differs from the existing Grafana folder name) and emits FileActionUpdated for direct
// children of affected folders. This ensures children are re-parented during the normal
// apply flow without scanning all resources.
func augmentChangesForUIDChanges(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	source []repository.FileTreeEntry,
	target *provisioning.ResourceList,
	changes []ResourceFileChange,
) ([]ResourceFileChange, error) {
	// 1. Find affected folders: folder updates where UID actually changed.
	// Also annotate the folder change with OldFolderUID for deferred cleanup.
	affectedFolders := make(map[string]bool)
	for i := range changes {
		change := &changes[i]
		if !change.IsUpdatedFolder() {
			continue
		}
		meta, _, err := resources.ReadFolderMetadata(ctx, repo, change.Path, ref)
		if err != nil {
			if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
				continue // no _folder.json — not metadata-backed, skip
			}
			return nil, fmt.Errorf("read folder metadata for %s: %w", change.Path, err)
		}
		if meta.Name != change.Existing.Name {
			affectedFolders[change.Path] = true
			change.FolderRenamed = true
		}
	}
	if len(affectedFolders) == 0 {
		return changes, nil
	}

	// 2. Build lookups
	existingPaths := make(map[string]bool, len(changes))
	for _, c := range changes {
		existingPaths[c.Path] = true
	}

	targetLookup := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	for i := range target.Items {
		item := &target.Items[i]
		path := item.Path
		if item.Group == resources.FolderResource.Group && !safepath.IsDir(path) {
			path += "/"
		}
		targetLookup[path] = item
	}

	// 3. Emit FileActionUpdated for direct children of affected folders
	for _, file := range source {
		path := file.Path
		if !file.Blob && !safepath.IsDir(path) {
			path += "/"
		}
		if resources.IsFolderMetadataFile(path) {
			continue
		}

		// Direct parent check
		parentDir := safepath.Dir(path)
		if !affectedFolders[parentDir] {
			continue
		}
		if existingPaths[path] {
			continue // already in changes
		}

		existing, ok := targetLookup[path]
		if !ok {
			continue // new resource, not a re-parenting case
		}

		changes = append(changes, ResourceFileChange{
			Action:   repository.FileActionUpdated,
			Path:     path,
			Existing: existing,
		})
		existingPaths[path] = true
	}

	// 4. Re-sort by depth (deepest first) since we appended new entries
	safepath.SortByDepth(changes, func(c ResourceFileChange) string { return c.Path }, false)
	return changes, nil
}

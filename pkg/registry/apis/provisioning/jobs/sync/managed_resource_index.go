package sync

import (
	"slices"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// managedResourceIndex is a path and name index over the current managed
// resources so the rebuilder can find existing folders and direct children
// efficiently. Multiple items may share the same path (orphaned resources
// from previous metadata.name changes) or the same name (different resource
// kinds); the index preserves all of them.
type managedResourceIndex struct {
	byPath map[string][]*provisioning.ResourceListItem
	byName map[string][]*provisioning.ResourceListItem
}

// newManagedResourceIndex builds a normalized path index over the current
// managed resources so metadata rewriting can look up folders and children by
// repository path.
func newManagedResourceIndex(target *provisioning.ResourceList) managedResourceIndex {
	index := managedResourceIndex{
		byPath: make(map[string][]*provisioning.ResourceListItem),
		byName: make(map[string][]*provisioning.ResourceListItem),
	}
	if target == nil {
		return index
	}

	for i := range target.Items {
		item := &target.Items[i]
		path := normalizeManagedResourcePath(item)
		index.byPath[path] = append(index.byPath[path], item)
		index.byName[item.Name] = append(index.byName[item.Name], item)
	}

	return index
}

// ExistingAt returns all managed resources currently tracked at the given
// normalized repository path. Multiple items at the same path indicate
// orphaned duplicates (e.g. from previous metadata.name changes).
func (index managedResourceIndex) ExistingAt(path string) []*provisioning.ResourceListItem {
	return index.byPath[path]
}

// DirectChildrenOf lists the managed resources whose direct parent is the
// provided folder path. Each path is returned once even if multiple items
// share the same path. The returned paths are sorted for deterministic output.
func (index managedResourceIndex) DirectChildrenOf(parentPath string) []string {
	childrenPaths := make([]string, 0)
	for path := range index.byPath {
		if safepath.Dir(path) == parentPath {
			childrenPaths = append(childrenPaths, path)
		}
	}
	slices.Sort(childrenPaths)
	return childrenPaths
}

// ExistingByName returns all managed resources with the given k8s name.
// Multiple items may share the same name when they belong to different
// resource kinds (e.g. a folder and a dashboard).
func (index managedResourceIndex) ExistingByName(name string) []*provisioning.ResourceListItem {
	return index.byName[name]
}

// normalizeManagedResourcePath makes folder entries comparable with source-tree
// directory paths by enforcing a trailing slash on managed folders only.
func normalizeManagedResourcePath(item *provisioning.ResourceListItem) string {
	if item.Group == resources.FolderResource.Group {
		return safepath.EnsureTrailingSlash(item.Path)
	}
	return item.Path
}

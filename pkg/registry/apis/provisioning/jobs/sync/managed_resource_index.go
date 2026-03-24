package sync

import (
	"slices"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// managedResourceIndex is a path index over the current managed resources so
// the rebuilder can find existing folders and direct children efficiently.
type managedResourceIndex struct {
	byPath map[string]*provisioning.ResourceListItem
}

// newManagedResourceIndex builds a normalized path index over the current
// managed resources so metadata rewriting can look up folders and children by
// repository path.
func newManagedResourceIndex(target *provisioning.ResourceList) managedResourceIndex {
	index := managedResourceIndex{
		byPath: make(map[string]*provisioning.ResourceListItem),
	}
	if target == nil {
		return index
	}

	for i := range target.Items {
		item := &target.Items[i]
		index.byPath[normalizeManagedResourcePath(item)] = item
	}

	return index
}

// ExistingAt returns the managed resource currently tracked at the given
// normalized repository path, if any.
func (index managedResourceIndex) ExistingAt(path string) *provisioning.ResourceListItem {
	return index.byPath[path]
}

// DirectChildrenOf lists the managed resources whose direct parent is the
// provided folder path. The returned paths are sorted for deterministic output.
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

// normalizeManagedResourcePath makes folder entries comparable with source-tree
// directory paths by enforcing a trailing slash on managed folders only.
func normalizeManagedResourcePath(item *provisioning.ResourceListItem) string {
	if item.Group == resources.FolderResource.Group {
		return safepath.EnsureTrailingSlash(item.Path)
	}
	return item.Path
}

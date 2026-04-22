package resources

import (
	"encoding/json"
	"sort"
	"strings"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// JSONPatchOperation represents a single JSON Patch (RFC 6902) operation.
type JSONPatchOperation struct {
	Op   string `json:"op"`
	Path string `json:"path"`
}

// GetReleasePatch returns a JSON Patch payload that removes the ownership
// annotations from a managed resource, effectively releasing it.
func GetReleasePatch(item *provisioning.ResourceListItem) ([]byte, error) {
	ops := []JSONPatchOperation{
		{Op: "remove", Path: "/metadata/annotations/" + EscapePatchString(utils.AnnoKeyManagerKind)},
		{Op: "remove", Path: "/metadata/annotations/" + EscapePatchString(utils.AnnoKeyManagerIdentity)},
	}

	if item.Path != "" {
		ops = append(ops, JSONPatchOperation{
			Op: "remove", Path: "/metadata/annotations/" + EscapePatchString(utils.AnnoKeySourcePath),
		})
	}
	if item.Hash != "" {
		ops = append(ops, JSONPatchOperation{
			Op: "remove", Path: "/metadata/annotations/" + EscapePatchString(utils.AnnoKeySourceChecksum),
		})
	}

	return json.Marshal(ops)
}

// EscapePatchString escapes a string for use in a JSON Pointer (RFC 6901)
// by replacing ~ with ~0 and / with ~1.
func EscapePatchString(s string) string {
	s = strings.ReplaceAll(s, "~", "~0")
	s = strings.ReplaceAll(s, "/", "~1")
	return s
}

// SortResourceListForRelease orders items top-down by depth so that parent
// resources are unmanaged before their children. At equal depth, folders are
// ordered before other resources so a folder is released before anything it
// contains at the same level.
//
// Example result for a repo with nested folders and dashboards:
//
//	folderA/                          (depth 1, folder)
//	root-dashboard.json               (depth 1, resource)
//	folderA/subfolderB/               (depth 2, folder)
//	folderA/dashboard.json            (depth 2, resource)
//	folderA/subfolderB/dashboard.json (depth 3, resource)
func SortResourceListForRelease(list *provisioning.ResourceList) {
	sort.SliceStable(list.Items, func(i, j int) bool {
		depthI := len(strings.Split(list.Items[i].Path, "/"))
		depthJ := len(strings.Split(list.Items[j].Path, "/"))
		if depthI != depthJ {
			return depthI < depthJ
		}

		isFolderI := list.Items[i].Group == folders.GroupVersion.Group
		isFolderJ := list.Items[j].Group == folders.GroupVersion.Group
		if isFolderI != isFolderJ {
			return isFolderI
		}

		return false
	})
}

// SplitItems separates a resource list into folder items and non-folder items,
// preserving the order within each group.
func SplitItems(items *provisioning.ResourceList) (folderItems, resourceItems []*provisioning.ResourceListItem) {
	for i := range items.Items {
		if items.Items[i].Group == folders.GroupVersion.Group {
			folderItems = append(folderItems, &items.Items[i])
		} else {
			resourceItems = append(resourceItems, &items.Items[i])
		}
	}
	return folderItems, resourceItems
}

// SortResourceListForDeletion sorts items so that non-folder resources come
// first (safe to delete in any order) followed by folders sorted deepest-first,
// ensuring child folders are emptied before their parents.
func SortResourceListForDeletion(list *provisioning.ResourceList) {
	sort.SliceStable(list.Items, func(i, j int) bool {
		isFolderI := list.Items[i].Group == folders.GroupVersion.Group
		isFolderJ := list.Items[j].Group == folders.GroupVersion.Group

		if isFolderI != isFolderJ {
			return !isFolderI
		}

		if !isFolderI && !isFolderJ {
			return false
		}

		hasFolderI := list.Items[i].Folder != ""
		hasFolderJ := list.Items[j].Folder != ""
		if hasFolderI != hasFolderJ {
			return hasFolderI
		}

		depthI := len(strings.Split(list.Items[i].Path, "/"))
		depthJ := len(strings.Split(list.Items[j].Path, "/"))
		if depthI != depthJ {
			return depthI > depthJ
		}

		return false
	})
}

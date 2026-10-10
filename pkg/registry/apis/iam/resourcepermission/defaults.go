package resourcepermission

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// MergeDefaultPermissions returns current, the spec.permissions of an existing
// ResourcePermission (nil when there is none yet), plus every default whose
// subject (kind+name) has no entry in it. Existing entries are never removed
// or changed, so a subject that already has a grant keeps it even when the
// default for that subject differs. The returned slice only holds plain JSON
// types so it can be stored in an unstructured object as-is. changed reports
// whether anything was added.
func MergeDefaultPermissions(current []any, defaults []map[string]any) (merged []any, changed bool) {
	have := make(map[[2]string]bool, len(current))
	merged = make([]any, 0, len(current)+len(defaults))
	for _, p := range current {
		entry, ok := p.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := entry["kind"].(string)
		name, _ := entry["name"].(string)
		have[[2]string{kind, name}] = true
		merged = append(merged, entry)
	}
	for _, d := range defaults {
		kind, _ := d["kind"].(string)
		name, _ := d["name"].(string)
		if have[[2]string{kind, name}] {
			continue
		}
		merged = append(merged, d)
		changed = true
	}
	return merged, changed
}

// FolderParents returns folderUID followed by the UIDs of all of its ancestors, in any order.
type FolderParents func(ctx context.Context, folderUID string) ([]string, error)

// verbRank orders ResourcePermission verbs so the broadest grant per subject wins.
var verbRank = map[string]int{"view": 1, "edit": 2, "admin": 3}

// InheritedPermissions returns the permissions a resource inside folderUID gets from the folder
// tree: the union of the ResourcePermission entries of that folder and of all its ancestors,
// keeping the broadest verb per subject (kind+name). Ancestors without a ResourcePermission are
// skipped. client is the ResourcePermission client for the resource's namespace.
func InheritedPermissions(ctx context.Context, client dynamic.ResourceInterface, parents FolderParents, folderUID string) ([]map[string]any, error) {
	chain, err := parents(ctx, folderUID)
	if err != nil {
		return nil, fmt.Errorf("resolve parents of folder %q: %w", folderUID, err)
	}

	byIndex := map[[2]string]int{}
	inherited := make([]map[string]any, 0)
	for _, uid := range chain {
		name := fmt.Sprintf("%s-%s-%s", folderv1.APIGroup, folderv1.RESOURCE, uid)
		obj, err := client.Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				continue
			}
			return nil, fmt.Errorf("get permissions of folder %q: %w", uid, err)
		}
		current, _, _ := unstructured.NestedSlice(obj.Object, "spec", "permissions")
		for _, p := range current {
			entry, ok := p.(map[string]any)
			if !ok {
				continue
			}
			kind, _ := entry["kind"].(string)
			subject, _ := entry["name"].(string)
			verb, _ := entry["verb"].(string)
			key := [2]string{kind, subject}
			if i, seen := byIndex[key]; seen {
				if have, _ := inherited[i]["verb"].(string); verbRank[verb] > verbRank[have] {
					inherited[i] = entry
				}
				continue
			}
			byIndex[key] = len(inherited)
			inherited = append(inherited, entry)
		}
	}
	return inherited, nil
}

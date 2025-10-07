package v1alpha1

import (
	"slices"
	"strings"
)

func (stars *StarsSpec) Add(group, kind, name string) {
	for i, r := range stars.Resource {
		if r.Group == group && r.Kind == kind {
			r.Names = append(r.Names, name)
			slices.Sort(r.Names)
			stars.Resource[i].Names = slices.Compact(r.Names)
			return
		}
	}

	// Add the resource kind
	stars.Resource = append(stars.Resource, StarsResource{
		Group: group,
		Kind:  kind,
		Names: []string{name},
	})
	stars.Normalize()
}

func (stars *StarsSpec) Remove(group, kind, name string) {
	for i, r := range stars.Resource {
		if r.Group == group && r.Kind == kind {
			idx := slices.Index(r.Names, name)
			if idx < 0 {
				return // does not exist
			}
			r.Names = append(r.Names[:idx], r.Names[idx+1:]...)
			stars.Resource[i].Names = r.Names
			if len(r.Names) == 0 {
				stars.Normalize()
			}
			return
		}
	}
}

// Makes sure everything is in sorted order
func (stars *StarsSpec) Normalize() {
	resources := make([]StarsResource, 0, len(stars.Resource))
	for _, r := range stars.Resource {
		if len(r.Names) > 0 {
			slices.Sort(r.Names)
			r.Names = slices.Compact(r.Names) // removes any duplicates
			resources = append(resources, r)
		}
	}
	slices.SortFunc(resources, func(a StarsResource, b StarsResource) int {
		return strings.Compare(a.Group+a.Kind, b.Group+b.Kind)
	})
	if len(resources) == 0 {
		resources = nil
	}
	stars.Resource = resources
}

func Changes(current []string, target []string) (added []string, removed []string, same []string) {
	lookup := map[string]bool{}
	for _, k := range current {
		lookup[k] = true
	}
	for _, k := range target {
		if lookup[k] {
			same = append(same, k)
			delete(lookup, k)
		} else {
			added = append(added, k)
		}
	}
	for k := range lookup {
		removed = append(removed, k)
	}
	return
}

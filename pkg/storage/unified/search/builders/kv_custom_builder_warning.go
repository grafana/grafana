package builders

import (
	"sort"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// KVSourcedKindsWithCustomBuilders is the warning seam for a kind that
// declares source.kv search fields but supplies its own custom document
// builder, so those fields would otherwise silently never get filled: a
// pure function returning, sorted by group then
// resource, the kinds in `kinds` that declare source.kv search fields and
// also have a custom document builder in `custom`. Startup code logs one
// warning per returned kind, and tests call this function directly.
//
// A pure filter+sort, not a lookup: `custom` maps every kind with a custom
// builder to true, so a kind absent from the map (or present as false) has
// no custom builder and is never reported, even if it's KV-sourced.
func KVSourcedKindsWithCustomBuilders(kinds []schema.GroupResource, custom map[schema.GroupResource]bool) []schema.GroupResource {
	var offenders []schema.GroupResource
	for _, k := range kinds {
		if custom[k] {
			offenders = append(offenders, k)
		}
	}
	sort.Slice(offenders, func(i, j int) bool {
		if offenders[i].Group != offenders[j].Group {
			return offenders[i].Group < offenders[j].Group
		}
		return offenders[i].Resource < offenders[j].Resource
	})
	return offenders
}

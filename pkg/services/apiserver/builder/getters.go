package builder

import "k8s.io/apimachinery/pkg/runtime/schema"

// ExtractGetters collects the APIGroupGetter implementations among builders, keyed by the
// GroupVersions each builder serves. A builder that does not implement APIGroupGetter simply
// has no entry - callers must treat a missing entry as "this GV does not participate", never
// as an error.
func ExtractGetters(builders []APIGroupBuilder) map[schema.GroupVersion]APIGroupGetter {
	getters := make(map[schema.GroupVersion]APIGroupGetter)
	for _, b := range builders {
		g, ok := b.(APIGroupGetter)
		if !ok {
			continue
		}
		for _, gv := range GetGroupVersions(b) {
			getters[gv] = g
		}
	}
	return getters
}

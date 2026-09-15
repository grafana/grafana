package resource

import "github.com/grafana/grafana-app-sdk/app"

// EnrolledWithoutSearchFields keeps kinds that were already served but declare
// no search fields, which Enrolled would otherwise drop.
//
// Temporary: we plan to stop asking for fields at all.
var EnrolledWithoutSearchFields = map[string]bool{
	"folder.grafana.app/folders":      true,
	"dashboard.grafana.app/notebooks": true,
}

// KindEnrolledInSearch reports whether a kind participates in search at all.
//
// Declared fields stand in for "someone reviewed this kind". Search works
// without them, so this gate is about review, not capability. It is the single
// gate shared by the /search route registration and the search-backed list
// path, so a kind that is not enrolled is never routed to the (empty) search
// index and stays on the store scan instead.
func KindEnrolledInSearch(group, resourceName string, kind app.ManifestVersionKind) bool {
	return len(kind.SearchFields) > 0 || EnrolledWithoutSearchFields[group+"/"+resourceName]
}

// ResourceEnrolledInSearch resolves the kind for (group, resourceName) from the
// known app manifests and reports whether any served version enrolls it in
// search.
func ResourceEnrolledInSearch(group, resourceName string) bool {
	for _, m := range AppManifests() {
		if m == nil || m.Group != group {
			continue
		}
		for _, v := range m.Versions {
			for _, k := range v.Kinds {
				if ManifestResourceName(k) == resourceName && KindEnrolledInSearch(group, resourceName, k) {
					return true
				}
			}
		}
	}
	return false
}

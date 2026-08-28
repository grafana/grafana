package resource

import (
	"maps"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
)

// SelectableFields returns a map keyed by (group, kind) to the list of
// selectable fields for known manifests.
func SelectableFields() map[LowerGroupResource][]string {
	return SelectableFieldsForManifests(AppManifests()...)
}

// AppManifestsWithKinds keeps only the manifests declaring a kind in some
// version.
func AppManifestsWithKinds(manifiests ...*app.ManifestData) []*app.ManifestData {
	filtered := make([]*app.ManifestData, 0, len(manifiests))
	for _, m := range manifiests {
		if m == nil {
			continue
		}
		hasKinds := false
		for _, v := range m.Versions {
			if len(v.Kinds) > 0 {
				hasKinds = true
				break
			}
		}
		if hasKinds {
			filtered = append(filtered, m)
		}
	}
	return filtered
}

// SelectableFieldsForManifests returns a map keyed by (group, kind) to the list
// of selectable fields (across all versions). Each kind is also keyed by
// (group, plural), pointing to the same fields.
func SelectableFieldsForManifests(manifests ...*app.ManifestData) map[LowerGroupResource][]string {
	fields := map[LowerGroupResource][]string{}
	for _, m := range manifests {
		if m == nil {
			continue
		}
		maps.Copy(fields, selectableFieldsForManifest(m))
	}
	return fields
}

func selectableFieldsForManifest(m *app.ManifestData) map[LowerGroupResource][]string {
	kindFields := map[string]map[string]bool{}
	kinds := map[string]app.ManifestVersionKind{}

	for _, version := range m.Versions {
		for _, kind := range version.Kinds {
			if len(kind.SelectableFields) > 0 {
				kinds[kind.Kind] = kind

				if kindFields[kind.Kind] == nil {
					kindFields[kind.Kind] = map[string]bool{}
				}
				for _, f := range kind.SelectableFields {
					kindFields[kind.Kind][f] = true
				}
			}
		}
	}

	fields := map[LowerGroupResource][]string{}
	for k, v := range kinds {
		fs := make([]string, 0, len(kindFields[k]))
		for f := range kindFields[k] {
			fs = append(fs, f)
		}
		slices.Sort(fs)

		fields[NewLowerGroupResource(m.Group, v.Kind)] = fs
		fields[NewLowerGroupResource(m.Group, v.Plural)] = fs
	}

	return fields
}

package resource

import (
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
)

// SelectableFields returns a map keyed by (group, kind) to the list of
// selectable fields for known manifests.
func SelectableFields() map[LowerGroupResource][]string {
	return SelectableFieldsForManifests(AppManifests())
}

func AppManifestsWithKinds(manifiests []app.Manifest) []app.Manifest {
	// Include manifests with kinds in any version.
	filtered := make([]app.Manifest, 0, len(manifiests))
	for _, m := range manifiests {
		if m.ManifestData == nil {
			continue
		}
		hasKinds := false
		for _, v := range m.ManifestData.Versions {
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
func SelectableFieldsForManifests(manifests []app.Manifest) map[LowerGroupResource][]string {
	fields := map[LowerGroupResource][]string{}
	for _, m := range manifests {
		for k, v := range selectableFieldsForManifest(m) {
			fields[k] = v
		}
	}
	return fields
}

func selectableFieldsForManifest(m app.Manifest) map[LowerGroupResource][]string {
	kindFields := map[string]map[string]bool{}
	kinds := map[string]app.ManifestVersionKind{}

	for _, version := range m.ManifestData.Versions {
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

		fields[NewLowerGroupResource(m.ManifestData.Group, v.Kind)] = fs
		fields[NewLowerGroupResource(m.ManifestData.Group, v.Plural)] = fs
	}

	return fields
}

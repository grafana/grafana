package resource

import (
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
)

// SelectableFields returns map of <group>/<Kind> to list of selectable fields for known manifests.
func SelectableFields() map[string][]string {
	return SelectableFieldsForManifests(AppManifests())
}

// SelectableFieldsForManifests returns map of <group/kind> to list of selectable fields (across all versions).
// Also <group/plural> is included as a key, pointing to the same fields.
// Keys are lower-case.
func SelectableFieldsForManifests(manifests []app.Manifest) map[string][]string {
	fields := map[string][]string{}
	for _, m := range manifests {
		for k, v := range selectableFieldsForManifest(m) {
			fields[k] = v
		}
	}
	return fields
}

func selectableFieldsForManifest(m app.Manifest) map[string][]string {
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

	fields := map[string][]string{}
	for k, v := range kinds {
		fs := make([]string, 0, len(kindFields[k]))
		for f := range kindFields[k] {
			fs = append(fs, f)
		}
		slices.Sort(fs)

		fields[strings.ToLower(m.ManifestData.Group+"/"+v.Kind)] = fs
		fields[strings.ToLower(m.ManifestData.Group+"/"+v.Plural)] = fs
	}

	return fields
}

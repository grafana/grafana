package resource

import (
	"strings"

	"github.com/grafana/grafana-app-sdk/app"

	folder "github.com/grafana/grafana/apps/folder/pkg/apis/manifestdata"
	iam "github.com/grafana/grafana/apps/iam/pkg/apis"
)

func AppManifests() []app.Manifest {
	return []app.Manifest{
		iam.LocalManifest(),
		folder.LocalManifest(),
	}
}

func SelectableFields() map[string][]string {
	return SelectableFieldsForManifests(AppManifests())
}

// SelectableFieldsForManifests returns map of <group/kind> to list of selectable fields.
// Also <group/plural> is included as a key, pointing to the same fields.
func SelectableFieldsForManifests(manifests []app.Manifest) map[string][]string {
	fields := map[string][]string{}

	for _, m := range manifests {
		group := m.ManifestData.Group

		for _, version := range m.ManifestData.Versions {
			for _, kind := range version.Kinds {
				key := strings.ToLower(group + "/" + kind.Kind)
				keyPlural := strings.ToLower(group + "/" + kind.Plural)

				if len(kind.SelectableFields) > 0 {
					fields[key] = kind.SelectableFields
					fields[keyPlural] = kind.SelectableFields
				}
			}
		}
	}

	return fields
}

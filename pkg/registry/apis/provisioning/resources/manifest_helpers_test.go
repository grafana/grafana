package resources

import (
	"github.com/grafana/grafana-app-sdk/app"
)

const testManifestGroup = "example.ext.grafana.app"

func testManifests(kinds ...app.ManifestVersionKind) []*app.ManifestData {
	return []*app.ManifestData{{
		AppName:  "example",
		Group:    testManifestGroup,
		Versions: []app.ManifestVersion{{Name: "v1", Kinds: kinds}},
	}}
}

func testManifestKind(kind string, provisionable bool, folderScoped bool) app.ManifestVersionKind {
	return app.ManifestVersionKind{
		Kind:         kind,
		Scope:        "Namespaced",
		FolderScoped: &folderScoped,
		Extensions: &app.ManifestVersionKindExtensions{
			Provisioning: &app.ManifestVersionKindProvisioning{Enabled: &provisionable},
		},
	}
}

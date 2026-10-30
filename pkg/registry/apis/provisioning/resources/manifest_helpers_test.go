package resources

import (
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

const testManifestGroup = "example.ext.grafana.app"

func testManifestList(kinds ...appmanifestv1alpha2.AppManifestManifestVersionKind) *appmanifestv1alpha2.AppManifestList {
	return &appmanifestv1alpha2.AppManifestList{Items: []appmanifestv1alpha2.AppManifest{{
		Spec: appmanifestv1alpha2.AppManifestSpec{
			AppName:  "example",
			Group:    testManifestGroup,
			Versions: []appmanifestv1alpha2.AppManifestManifestVersion{{Name: "v1", Kinds: kinds}},
		},
	}}}
}

func testManifestKind(kind string, provisionable bool, folderScoped bool, ui *appmanifestv1alpha2.AppManifestManifestVersionKindUI) appmanifestv1alpha2.AppManifestManifestVersionKind {
	return appmanifestv1alpha2.AppManifestManifestVersionKind{
		Kind:         kind,
		Scope:        appmanifestv1alpha2.AppManifestManifestVersionKindScopeNamespaced,
		FolderScoped: &folderScoped,
		Provisioning: &appmanifestv1alpha2.AppManifestManifestVersionKindProvisioning{Enabled: &provisionable},
		Ui:           ui,
	}
}

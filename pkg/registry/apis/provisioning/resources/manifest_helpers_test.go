package resources

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

const testManifestGroup = "example.ext.grafana.app"

func testManifestList(served bool, kinds ...appmanifestv1alpha2.AppManifestManifestVersionKind) *appmanifestv1alpha2.AppManifestList {
	return &appmanifestv1alpha2.AppManifestList{
		TypeMeta: metav1.TypeMeta{APIVersion: appmanifestv1alpha2.GroupVersion.String(), Kind: "AppManifestList"},
		Items: []appmanifestv1alpha2.AppManifest{{
			ObjectMeta: metav1.ObjectMeta{Name: testManifestGroup},
			Spec: appmanifestv1alpha2.AppManifestSpec{
				AppName:  "example",
				Group:    testManifestGroup,
				Versions: []appmanifestv1alpha2.AppManifestManifestVersion{{Name: "v1", Served: &served, Kinds: kinds}},
			},
		}},
	}
}

func testManifestKind(kind string, provisionable bool, folderScoped bool) appmanifestv1alpha2.AppManifestManifestVersionKind {
	return appmanifestv1alpha2.AppManifestManifestVersionKind{
		Kind:         kind,
		Scope:        appmanifestv1alpha2.AppManifestManifestVersionKindScopeNamespaced,
		FolderScoped: &folderScoped,
		Extensions: &appmanifestv1alpha2.AppManifestManifestVersionKindExtensions{
			Provisioning: &appmanifestv1alpha2.AppManifestManifestVersionKindProvisioning{Enabled: &provisionable},
		},
	}
}

// testManifests returns one app manifest that opts each resource in to provisioning.
func testManifests(resources ...SupportedResource) []*app.ManifestData {
	enabled := true
	version := app.ManifestVersion{Name: "v1", Served: true}
	for _, r := range resources {
		folderScoped := r.Capabilities.Has(CapabilityFolder)
		version.Kinds = append(version.Kinds, app.ManifestVersionKind{
			Kind:         r.Kind,
			Scope:        "Namespaced",
			FolderScoped: &folderScoped,
			Extensions:   &app.ManifestVersionKindExtensions{Provisioning: &app.ManifestVersionKindProvisioning{Enabled: &enabled}},
		})
	}
	return []*app.ManifestData{{Group: testManifestGroup, Versions: []app.ManifestVersion{version}}}
}

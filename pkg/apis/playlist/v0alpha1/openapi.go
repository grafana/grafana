package v0alpha1

import (
	common "k8s.io/kube-openapi/pkg/common"
)

// NOTE: this must match the golang fully qualified name!
const kindPkg = "github.com/grafana/grafana/pkg/kinds/playlist."

func getOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		kindPkg + "Playlist":     schema_pkg_apis_playlist_v0alpha1_Playlist(ref),
		kindPkg + "PlaylistList": schema_pkg_apis_playlist_v0alpha1_PlaylistList(ref),
		kindPkg + "Item":         schema_pkg_apis_playlist_v0alpha1_Item(ref),
		kindPkg + "Spec":         schema_pkg_apis_playlist_v0alpha1_Spec(ref),
	}
}

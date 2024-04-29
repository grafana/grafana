package playlist

import (
	"github.com/grafana/grafana-app-sdk/apiserver"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/apis/playlist/v0alpha1"
)

func ResourceGroups() []*apiserver.ResourceGroup {
	playlistV0Alpha1 := apiserver.Resource{
		Kind:                  playlistv0alpha1.PlaylistKind(),
		GetOpenAPIDefinitions: playlistv0alpha1.GetOpenAPIDefinitions,
	}
	playlistGroup := apiserver.NewResourceGroup(playlistV0Alpha1.Kind.Group(), []apiserver.Resource{playlistV0Alpha1})
	return []*apiserver.ResourceGroup{playlistGroup}
}

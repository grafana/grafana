package v0alpha1

// This package is a thin wrapper around v1, since v0alpha1 and v1 have identical schemas.
// This eliminates code duplication while maintaining backward compatibility.

import (
	"github.com/grafana/grafana-app-sdk/resource"
	v1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
)

type (
	Playlist                         = v1.Playlist
	PlaylistList                     = v1.PlaylistList
	PlaylistSpec                     = v1.PlaylistSpec
	PlaylistStatus                   = v1.PlaylistStatus
	PlaylistItem                     = v1.PlaylistItem
	PlaylistPlaylistItem             = v1.PlaylistPlaylistItem
	PlaylistPlaylistItemType         = v1.PlaylistPlaylistItemType
	PlayliststatusOperatorState      = v1.PlayliststatusOperatorState
	PlaylistStatusOperatorStateState = v1.PlaylistStatusOperatorStateState
	PlaylistClient                   = v1.PlaylistClient
	PlaylistJSONCodec                = v1.PlaylistJSONCodec
)

const (
	PlaylistPlaylistItemTypeDashboardByTag = v1.PlaylistPlaylistItemTypeDashboardByTag
	PlaylistPlaylistItemTypeDashboardByUid = v1.PlaylistPlaylistItemTypeDashboardByUid
	PlaylistPlaylistItemTypeDashboardById  = v1.PlaylistPlaylistItemTypeDashboardById
)

var (
	NewPlaylist                    = v1.NewPlaylist
	NewPlaylistSpec                = v1.NewPlaylistSpec
	NewPlaylistStatus              = v1.NewPlaylistStatus
	NewPlaylistItem                = v1.NewPlaylistItem
	NewPlaylistPlaylistItem        = v1.NewPlaylistPlaylistItem
	NewPlayliststatusOperatorState = v1.NewPlayliststatusOperatorState
	NewPlaylistClient              = v1.NewPlaylistClient
	NewPlaylistClientFromGenerator = v1.NewPlaylistClientFromGenerator
)

var (
	schemaPlaylist = resource.NewSimpleSchema(APIGroup, APIVersion, NewPlaylist(), &PlaylistList{},
		resource.WithKind("Playlist"),
		resource.WithPlural("playlists"),
		resource.WithScope(resource.NamespacedScope))
	kindPlaylist = resource.Kind{
		Schema: schemaPlaylist,
		Codecs: map[resource.KindEncoding]resource.Codec{
			resource.KindEncodingJSON: &PlaylistJSONCodec{},
		},
	}
)

func PlaylistKind() resource.Kind {
	return kindPlaylist
}

func PlaylistSchema() *resource.SimpleSchema {
	return schemaPlaylist
}

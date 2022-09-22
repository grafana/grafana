package playlist

import (
	"errors"

	"github.com/grafana/grafana/pkg/coremodel/playlist"
)

// Typed errors
var (
	ErrPlaylistNotFound                = errors.New("Playlist not found")
	ErrPlaylistFailedGenerateUniqueUid = errors.New("failed to generate unique playlist UID")
	ErrCommandValidationFailed         = errors.New("command missing required fields")
)

// Playlist model
type Playlist = playlist.Model
type PlaylistItem = playlist.Items

type PlaylistWithOrgID struct {
	Playlist
	OrgId int64
}

type Playlists []*Playlist

//
// COMMANDS
//

type UpdatePlaylistCommand struct {
	OrgId    int64          `json:"-"`
	UID      string         `json:"uid"`
	Name     string         `json:"name" binding:"Required"`
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
}

type CreatePlaylistCommand struct {
	Name     string         `json:"name" binding:"Required"`
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
	OrgId    int64          `json:"-"`
}

type DeletePlaylistCommand struct {
	UID   string
	OrgId int64
}

//
// QUERIES
//

type GetPlaylistsQuery struct {
	Name  string
	Limit int
	OrgId int64
}

type GetPlaylistByUidQuery struct {
	UID   string
	OrgId int64
}

type GetPlaylistItemsByUidQuery struct {
	PlaylistUID string
	OrgId       int64
}

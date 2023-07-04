package playlist

import (
	"errors"

	"github.com/grafana/grafana/pkg/kinds/playlist"
)

// Typed errors
var (
	ErrPlaylistNotFound                = errors.New("Playlist not found")
	ErrPlaylistFailedGenerateUniqueUid = errors.New("failed to generate unique playlist UID")
	ErrCommandValidationFailed         = errors.New("command missing required fields")
)

// Playlist model
type Playlist struct {
	Id       int64  `json:"id,omitempty" db:"id"`
	UID      string `json:"uid" xorm:"uid" db:"uid"`
	Name     string `json:"name" db:"name"`
	Interval string `json:"interval" db:"interval"`
	OrgId    int64  `json:"-" db:"org_id"`
}

type PlaylistDTO = playlist.Spec
type PlaylistItemDTO = playlist.Item
type PlaylistItemType = playlist.ItemType

type PlaylistItem struct {
	Id         int64  `db:"id"`
	PlaylistId int64  `db:"playlist_id"`
	Type       string `json:"type" db:"type"`
	Value      string `json:"value" db:"value"`
	Order      int    `json:"order" db:"order"`
	Title      string `json:"title" db:"title"`
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
	// NOTE: the frontend never sends this query
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

func PlaylistToResource(p PlaylistDTO) playlist.K8sResource {
	copy := p
	r := playlist.NewK8sResource(p.Uid, &copy)
	copy.Uid = "" // remove it from the payload
	return r
}

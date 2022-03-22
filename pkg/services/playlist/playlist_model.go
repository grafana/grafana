package playlist

import (
	"errors"

	"github.com/grafana/grafana/pkg/models"
)

// Typed errors
var (
	ErrPlaylistNotFound = errors.New("Playlist not found")
)

// Playlist model
type Playlist struct {
	Id       int64  `json:"id"`
	Name     string `json:"name"`
	Interval string `json:"interval"`
	OrgId    int64  `json:"-"`
}

type PlaylistDTO struct {
	Id       int64             `json:"id"`
	Name     string            `json:"name"`
	Interval string            `json:"interval"`
	OrgId    int64             `json:"-"`
	Items    []PlaylistItemDTO `json:"items"`
}

type PlaylistItemDTO struct {
	Id         int64  `json:"id"`
	PlaylistId int64  `json:"playlistid"`
	Type       string `json:"type"`
	Title      string `json:"title"`
	Value      string `json:"value"`
	Order      int    `json:"order"`
}

type PlaylistItem struct {
	Id         int64
	PlaylistId int64
	Type       string
	Value      string
	Order      int
	Title      string
}

type Playlists []*Playlist

//
// COMMANDS
//

type UpdatePlaylistCommand struct {
	OrgId    int64             `json:"-"`
	Id       int64             `json:"id"`
	Name     string            `json:"name" binding:"Required"`
	Interval string            `json:"interval"`
	Items    []PlaylistItemDTO `json:"items"`
}

type UpdatePlaylistResult *PlaylistDTO

type CreatePlaylistCommand struct {
	Name     string            `json:"name" binding:"Required"`
	Interval string            `json:"interval"`
	Items    []PlaylistItemDTO `json:"items"`

	OrgId int64 `json:"-"`
}

type CreatePlaylistResult *Playlist

type DeletePlaylistCommand struct {
	Id    int64
	OrgId int64
}

func (cmd *DeletePlaylistCommand) Validate() error {
	if cmd.Id == 0 || cmd.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}
	return nil
}

//
// QUERIES
//

type GetPlaylistsQuery struct {
	Name  string
	Limit int
	OrgId int64
}

type SearchPlaylistsResult struct {
	Playlists Playlists
}

type GetPlaylistByIdQuery struct {
	Id int64
}

func (q *GetPlaylistByIdQuery) Validate() error {
	if q.Id == 0 {
		return models.ErrCommandValidationFailed
	}
	return nil
}

type GetPlaylistResult *Playlist

type GetPlaylistItemsByIdQuery struct {
	PlaylistId int64
}

func (query *GetPlaylistItemsByIdQuery) Validate() error {
	if query.PlaylistId == 0 {
		return models.ErrCommandValidationFailed
	}
	return nil
}

type GetPlaylistItemsResult struct {
	Items *[]PlaylistItem
}

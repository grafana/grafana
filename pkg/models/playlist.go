package models

import (
	"errors"
)

// Typed errors
var (
	ErrPlaylistNotFound                = errors.New("Playlist not found")
	ErrPlaylistFailedGenerateUniqueUid = errors.New("failed to generate unique playlist UID")
)

// Playlist model
type Playlist struct {
	Uid      string `json:"uid"`
	Name     string `json:"name"`
	Interval string `json:"interval"`
	OrgId    int64  `json:"-"`
}

type PlaylistDTO struct {
	Uid      string            `json:"uid"`
	Name     string            `json:"name"`
	Interval string            `json:"interval"`
	OrgId    int64             `json:"-"`
	Items    []PlaylistItemDTO `json:"items"`
}

type PlaylistItemDTO struct {
	Id          int64  `json:"id"`
	PlaylistUid string `json:"playlistuid"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Value       string `json:"value"`
	Order       int    `json:"order"`
}

type PlaylistItem struct {
	Id          int64
	PlaylistUid string
	Type        string
	Value       string
	Order       int
	Title       string
}

type Playlists []*Playlist

//
// COMMANDS
//

type UpdatePlaylistCommand struct {
	OrgId    int64             `json:"-"`
	Uid      string            `json:"uid"`
	Name     string            `json:"name" binding:"Required"`
	Interval string            `json:"interval"`
	Items    []PlaylistItemDTO `json:"items"`

	Result *PlaylistDTO
}

type CreatePlaylistCommand struct {
	Name     string            `json:"name" binding:"Required"`
	Interval string            `json:"interval"`
	Items    []PlaylistItemDTO `json:"items"`

	OrgId  int64 `json:"-"`
	Result *Playlist
}

type DeletePlaylistCommand struct {
	Uid   string
	OrgId int64
}

//
// QUERIES
//

type GetPlaylistsQuery struct {
	Name  string
	Limit int
	OrgId int64

	Result Playlists
}

type GetPlaylistByUidQuery struct {
	Uid    string
	Result *Playlist
}

type GetPlaylistItemsByUidQuery struct {
	PlaylistUid string
	Result      *[]PlaylistItem
}

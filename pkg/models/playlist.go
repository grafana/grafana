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
	Id       int64  `json:"id"`
	UID      string `json:"uid" xorm:"uid"`
	Name     string `json:"name"`
	Interval string `json:"interval"`
	OrgId    int64  `json:"-"`
}

type PlaylistDTO struct {
	Id       int64             `json:"id"`
	UID      string            `json:"uid"`
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
	UID      string            `json:"uid"`
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

	Result Playlists
}

type GetPlaylistByUidQuery struct {
	UID    string
	OrgId  int64
	Result *Playlist
}

type GetPlaylistItemsByUidQuery struct {
	PlaylistUID string
	OrgId       int64
	Result      *[]PlaylistItem
}

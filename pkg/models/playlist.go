package models

import (
	"errors"
)

// Typed errors
var (
	ErrPlaylistNotFound           = errors.New("Playlist not found")
	ErrPlaylistWithSameNameExists = errors.New("A playlist with the same name already exists")
)

// Playlist model
type Playlist struct {
	Id       int64  `json:"id"`
	Title    string `json:"title"`
	Timespan string `json:"timespan"`
	OrgId    int64  `json:"-"`
}

type PlaylistDTO struct {
	Id       int64             `json:"id"`
	Title    string            `json:"title"`
	Timespan string            `json:"timespan"`
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

type PlaylistDashboard struct {
	Id    int64  `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

type PlaylistItem struct {
	Id         int64
	PlaylistId int64
	Type       string
	Value      string
	Order      int
	Title      string
}

func (this PlaylistDashboard) TableName() string {
	return "dashboard"
}

type Playlists []*Playlist
type PlaylistDashboards []*PlaylistDashboard

//
// DTOS
//

type PlaylistDashboardDto struct {
	Id    int64  `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
	Uri   string `json:"uri"`
}

//
// COMMANDS
//
type PlaylistQuery struct {
	Title string
	Limit int
	OrgId int64

	Result Playlists
}

type UpdatePlaylistQuery struct {
	Id       int64
	Title    string
	Type     string
	Timespan string
	Items    []PlaylistItemDTO

	Result *PlaylistDTO
}

type CreatePlaylistQuery struct {
	Title    string
	Type     string
	Timespan string
	Data     []int64
	OrgId    int64
	Items    []PlaylistItemDTO

	Result *Playlist
}

type GetPlaylistByIdQuery struct {
	Id     int64
	Result *Playlist
}

type GetPlaylistItemsByIdQuery struct {
	PlaylistId int64
	Result     *[]PlaylistItem
}

type GetPlaylistDashboardsQuery struct {
	DashboardIds []int64
	Result       *PlaylistDashboards
}

type DeletePlaylistQuery struct {
	Id int64
}

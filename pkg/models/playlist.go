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
	Data     []int  `json:"data"`
}

type PlaylistDashboard struct {
	Id    int64  `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

func (this PlaylistDashboard) TableName() string {
	return "dashboard"
}

type Playlists []*Playlist
type PlaylistDashboards []*PlaylistDashboard

//
// COMMANDS
//
type PlaylistQuery struct {
	Title string
	Limit int

	Result Playlists
}

type UpdatePlaylistQuery struct {
	Id       int64
	Title    string
	Timespan string
	Data     []int

	Result *Playlist
}

type CreatePlaylistQuery struct {
	Title    string
	Timespan string
	Data     []int

	Result *Playlist
}

type GetPlaylistByIdQuery struct {
	Id     int64
	Result *Playlist
}

type GetPlaylistDashboardsQuery struct {
	Id     int64
	Result *PlaylistDashboards
}

type DeletePlaylistQuery struct {
	Id int64
}

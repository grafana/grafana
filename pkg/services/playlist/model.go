package playlist

import (
	"errors"
)

// Typed errors
var (
	ErrPlaylistNotFound        = errors.New("Playlist not found")
	ErrCommandValidationFailed = errors.New("command missing required fields")
)

// Playlist model
type Playlist struct {
	Id       int64  `json:"id,omitempty" db:"id"`
	UID      string `json:"uid" xorm:"uid" db:"uid"`
	Name     string `json:"name" db:"name"`
	Interval string `json:"interval" db:"interval"`
	OrgId    int64  `json:"-" db:"org_id"`

	// Added for kubernetes migration + synchronization
	// Hidden from json because this is used for openapi generation
	// Using int64 rather than time.Time to avoid database issues with time support
	CreatedAt int64 `json:"-" db:"created_at"`
	UpdatedAt int64 `json:"-" db:"updated_at"`
}

type PlaylistDTO struct {
	// Unique playlist identifier. Generated on creation, either by the
	// creator of the playlist of by the application.
	Uid string `json:"uid" db:"uid"`

	// Name of the playlist.
	Name string `json:"name"`

	// Interval sets the time between switching views in a playlist.
	Interval string `json:"interval"`

	// The ordered list of items that the playlist will iterate over.
	Items []PlaylistItemDTO `json:"items"`

	// Returned for k8s
	CreatedAt int64 `json:"-" db:"created_at"`

	// Returned for k8s
	UpdatedAt int64 `json:"-" db:"updated_at"`

	// Returned for k8s
	OrgID int64 `json:"-" db:"org_id"`

	// Returned for k8s and added as an annotation
	Id int64 `json:"-" db:"id"`
}

type PlaylistItemDTO struct {
	// Title is an unused property -- it will be removed in the future
	Title *string `json:"title,omitempty"`

	// Type of the item.
	Type string `json:"type"`

	// Value depends on type and describes the playlist item.
	//
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	Value string `json:"value"`
}

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
	// Used to create playlists from kubectl with a known uid/name
	UID string `json:"-"`
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

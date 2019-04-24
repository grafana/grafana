package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrPreferencesNotFound = errors.New("Preferences not found")
)

type Preferences struct {
	Id              int64
	OrgId           int64
	UserId          int64
	TeamId          int64
	Version         int
	HomeDashboardId int64
	Timezone        string
	Theme           string
	Created         time.Time
	Updated         time.Time
}

// ---------------------
// QUERIES

type GetPreferencesQuery struct {
	Id     int64
	OrgId  int64
	UserId int64
	TeamId int64

	Result *Preferences
}

type GetPreferencesWithDefaultsQuery struct {
	User *SignedInUser

	Result *Preferences
}

// ---------------------
// COMMANDS
type SavePreferencesCommand struct {
	UserId int64
	OrgId  int64
	TeamId int64

	HomeDashboardId int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
	Theme           string `json:"theme"`
}

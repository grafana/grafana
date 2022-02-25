package models

import (
	"time"
)

type Preferences struct {
	Id              int64
	OrgId           int64
	UserId          int64
	TeamId          int64
	Version         int
	HomeDashboardId int64
	Timezone        string
	WeekStart       string
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
}

type GetPreferencesWithDefaultsQuery struct {
	User *SignedInUser
}

type ListPreferencesQuery struct {
	Teams  []int64
	OrgID  int64
	UserID int64
}

// ---------------------
// COMMANDS
type SavePreferencesCommand struct {
	UserId int64
	OrgId  int64
	TeamId int64

	HomeDashboardId int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
	WeekStart       string `json:"weekStart"`
	Theme           string `json:"theme"`
}

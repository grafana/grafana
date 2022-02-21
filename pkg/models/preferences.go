package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
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
	QueryHistory    *simplejson.Json
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

	HomeDashboardId int64            `json:"homeDashboardId"`
	Timezone        string           `json:"timezone"`
	WeekStart       string           `json:"weekStart"`
	Theme           string           `json:"theme"`
	QueryHistory    *simplejson.Json `json:"queryHistory"`
}

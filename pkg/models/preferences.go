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
	Created         time.Time
	Updated         time.Time
	JsonData        *simplejson.Json
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

type GetJsonDataQuery struct {
	Id     int64
	OrgId  int64
	UserId int64
	TeamId int64

	Result *Preferences
}

type GetJsonDataWithDefaultsQuery struct {
	User *SignedInUser

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
	WeekStart       string `json:"weekStart"`
	Theme           string `json:"theme"`
}

type SaveJsonDataCommand struct {
	UserId int64
	OrgId  int64
	TeamId int64

	JsonData *simplejson.Json `json:"jsonData"`
}

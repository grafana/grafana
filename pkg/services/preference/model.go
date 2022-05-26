package pref

import (
	"bytes"
	"encoding/json"
	"errors"
	"time"
)

var ErrPrefNotFound = errors.New("preference not found")

type Preference struct {
	ID              int64   `xorm:"pk autoincr 'id'"`
	OrgID           int64   `xorm:"org_id"`
	UserID          int64   `xorm:"user_id"`
	TeamID          int64   `xorm:"team_id"`
	Teams           []int64 `xorm:"extends"`
	Version         int
	HomeDashboardID int64 `xorm:"home_dashboard_id"`
	Timezone        string
	WeekStart       string
	Theme           string
	Created         time.Time
	Updated         time.Time
	JSONData        *PreferenceJSONData `xorm:"json_data"`
}

type GetPreferenceWithDefaultsQuery struct {
	Teams  []int64
	OrgID  int64
	UserID int64
}

type GetPreferenceQuery struct {
	OrgID  int64
	UserID int64
	TeamID int64
}

type SavePreferenceCommand struct {
	UserID int64
	OrgID  int64
	TeamID int64

	HomeDashboardID  int64                   `json:"homeDashboardId,omitempty"`
	HomeDashboardUID *string                 `json:"homeDashboardUID,omitempty"`
	Timezone         string                  `json:"timezone,omitempty"`
	WeekStart        string                  `json:"weekStart,omitempty"`
	Theme            string                  `json:"theme,omitempty"`
	Navbar           *NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     *QueryHistoryPreference `json:"queryHistory,omitempty"`
}

type PatchPreferenceCommand struct {
	UserID int64
	OrgID  int64
	TeamID int64

	HomeDashboardID  *int64                  `json:"homeDashboardId,omitempty"`
	HomeDashboardUID *string                 `json:"homeDashboardUID,omitempty"`
	Timezone         *string                 `json:"timezone,omitempty"`
	WeekStart        *string                 `json:"weekStart,omitempty"`
	Theme            *string                 `json:"theme,omitempty"`
	Navbar           *NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     *QueryHistoryPreference `json:"queryHistory,omitempty"`
}

type NavLink struct {
	ID     string `json:"id,omitempty"`
	Text   string `json:"text,omitempty"`
	Url    string `json:"url,omitempty"`
	Target string `json:"target,omitempty"`
}

type NavbarPreference struct {
	SavedItems []NavLink `json:"savedItems"`
}

type PreferenceJSONData struct {
	Navbar       NavbarPreference       `json:"navbar"`
	QueryHistory QueryHistoryPreference `json:"queryHistory"`
}

type QueryHistoryPreference struct {
	HomeTab string `json:"homeTab"`
}

func (j *PreferenceJSONData) FromDB(data []byte) error {
	dec := json.NewDecoder(bytes.NewBuffer(data))
	dec.UseNumber()
	return dec.Decode(j)
}

func (j *PreferenceJSONData) ToDB() ([]byte, error) {
	if j == nil {
		return nil, nil
	}

	return json.Marshal(j)
}

func (p Preference) TableName() string { return "preferences" }

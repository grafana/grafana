package pref

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var ErrPrefNotFound = errors.New("preference not found")

type Preference struct {
	ID              int64               `xorm:"pk autoincr 'id'" db:"id"`
	OrgID           int64               `xorm:"org_id" db:"org_id"`
	UserID          int64               `xorm:"user_id" db:"user_id"`
	TeamID          int64               `xorm:"team_id" db:"team_id"`
	Teams           []int64             `xorm:"extends"`
	Version         int                 `db:"version"`
	HomeDashboardID int64               `xorm:"home_dashboard_id" db:"home_dashboard_id"`
	Timezone        string              `db:"timezone"`
	WeekStart       *string             `db:"week_start"`
	Theme           string              `db:"theme"`
	Created         time.Time           `db:"created"`
	Updated         time.Time           `db:"updated"`
	JSONData        *PreferenceJSONData `xorm:"json_data" db:"json_data"`
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
	Language         string                  `json:"language,omitempty"`
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
	Language         *string                 `json:"language,omitempty"`
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
	Language     string                 `json:"language"`
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

func (j *PreferenceJSONData) Scan(val interface{}) error {
	switch v := val.(type) {
	case []byte:
		if len(v) == 0 {
			return nil
		}
		return json.Unmarshal(v, &j)
	case string:
		if len(v) == 0 {
			return nil
		}
		return json.Unmarshal([]byte(v), &j)
	default:
		return fmt.Errorf("unsupported type: %T", v)
	}
}

func (j *PreferenceJSONData) Value() (driver.Value, error) {
	return j.ToDB()
}

func (j *PreferenceJSONData) ToDB() ([]byte, error) {
	if j == nil {
		return nil, nil
	}

	return json.Marshal(j)
}

func (p Preference) TableName() string { return "preferences" }

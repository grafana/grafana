package pref

import (
	"bytes"
	"encoding/json"
	"errors"
	"time"
)

var ErrPrefNotFound = errors.New("preference not found")

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
	JsonData        *PreferencesJsonData
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

	HomeDashboardId int64             `json:"homeDashboardId,omitempty"`
	Timezone        string            `json:"timezone,omitempty"`
	WeekStart       string            `json:"weekStart,omitempty"`
	Theme           string            `json:"theme,omitempty"`
	Navbar          *NavbarPreference `json:"navbar,omitempty"`
}

type ListPreferenceQuery struct {
	Teams  []int64
	OrgID  int64
	UserID int64
}

type PatchPreferenceCommand struct {
	UserID int64
	OrgID  int64
	TeamID int64

	HomeDashboardId *int64            `json:"homeDashboardId,omitempty"`
	Timezone        *string           `json:"timezone,omitempty"`
	WeekStart       *string           `json:"weekStart,omitempty"`
	Theme           *string           `json:"theme,omitempty"`
	Navbar          *NavbarPreference `json:"navbar,omitempty"`
}

type NavLink struct {
	Id     string `json:"id,omitempty"`
	Text   string `json:"text,omitempty"`
	Url    string `json:"url,omitempty"`
	Target string `json:"target,omitempty"`
}

type NavbarPreference struct {
	SavedItems []NavLink `json:"savedItems"`
}

type PreferencesJsonData struct {
	Navbar NavbarPreference `json:"navbar"`
}

func (j *PreferencesJsonData) FromDB(data []byte) error {
	dec := json.NewDecoder(bytes.NewBuffer(data))
	dec.UseNumber()
	return dec.Decode(j)
}

func (j *PreferencesJsonData) ToDB() ([]byte, error) {
	if j == nil {
		return nil, nil
	}

	return json.Marshal(j)
}

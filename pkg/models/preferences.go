package models

import (
	"bytes"
	"encoding/json"
	"time"
)

type NavLink struct {
	Id     string `json:"id,omitempty"`
	Text   string `json:"text,omitempty"`
	Url    string `json:"url,omitempty"`
	Target string `json:"target,omitempty"`
}

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

// The following needed for to implement the xorm/database ORM Conversion interface do the
// conversion when reading/writing to the database, see https://gobook.io/read/gitea.com/xorm/manual-en-US/chapter-02/4.columns.html.

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

type NavbarPreference struct {
	SavedItems []NavLink `json:"savedItems"`
}

type PreferencesJsonData struct {
	Navbar NavbarPreference `json:"navbar"`
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

	HomeDashboardId int64             `json:"homeDashboardId,omitempty"`
	Timezone        string            `json:"timezone,omitempty"`
	WeekStart       string            `json:"weekStart,omitempty"`
	Theme           string            `json:"theme,omitempty"`
	Navbar          *NavbarPreference `json:"navbar,omitempty"`
}

type PatchPreferencesCommand struct {
	UserId int64
	OrgId  int64
	TeamId int64

	HomeDashboardId *int64            `json:"homeDashboardId,omitempty"`
	Timezone        *string           `json:"timezone,omitempty"`
	WeekStart       *string           `json:"weekStart,omitempty"`
	Theme           *string           `json:"theme,omitempty"`
	Navbar          *NavbarPreference `json:"navbar,omitempty"`
}

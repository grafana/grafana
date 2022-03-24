package pref

import (
	"time"
)

type Preference struct {
	ID              int64
	UserID          int64
	OrgID           int64
	TeamID          int64
	Theme           string
	Timezone        string
	WeekStart       string
	HomeDashboardID int64
	Created         time.Time
	Updated         time.Time
	Version         int64
	// JsonData        *PreferencesJsonData
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
	OrgID           int64
	UserID          int64
	TeamID          int64
	HomeDashboardID int64
	Timezone        string
	WeekStart       string
	Theme           string
}

type ListPreferenceQuery struct {
	Teams  []int64
	OrgID  int64
	UserID int64
}

// type NavLink struct {
// 	Id     string `json:"id,omitempty"`
// 	Text   string `json:"text,omitempty"`
// 	Url    string `json:"url,omitempty"`
// 	Target string `json:"target,omitempty"`
// }

// type NavbarPreference struct {
// 	SavedItems []NavLink `json:"savedItems"`
// }

// type PreferencesJsonData struct {
// 	Navbar NavbarPreference `json:"navbar"`
// }

// func (j *PreferencesJsonData) FromDB(data []byte) error {
// 	dec := json.NewDecoder(bytes.NewBuffer(data))
// 	dec.UseNumber()
// 	return dec.Decode(j)
// }

// func (j *PreferencesJsonData) ToDB() ([]byte, error) {
// 	if j == nil {
// 		return nil, nil
// 	}

// 	return json.Marshal(j)
// }

package pref

import "time"

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

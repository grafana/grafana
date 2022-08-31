package dtos

import (
	pref "github.com/grafana/grafana/pkg/services/preference"
)

type Prefs struct {
	Theme            string                      `json:"theme"`
	HomeDashboardID  int64                       `json:"homeDashboardId"`
	HomeDashboardUID string                      `json:"homeDashboardUID,omitempty"`
	Timezone         string                      `json:"timezone"`
	WeekStart        string                      `json:"weekStart"`
	Locale           string                      `json:"locale"`
	Navbar           pref.NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     pref.QueryHistoryPreference `json:"queryHistory,omitempty"`
}

// swagger:model
type UpdatePrefsCmd struct {
	// Enum: light,dark
	Theme string `json:"theme"`
	// The numerical :id of a favorited dashboard
	// Default:0
	HomeDashboardID  int64   `json:"homeDashboardId"`
	HomeDashboardUID *string `json:"homeDashboardUID,omitempty"`
	// Enum: utc,browser
	Timezone     string                       `json:"timezone"`
	WeekStart    string                       `json:"weekStart"`
	Navbar       *pref.NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory *pref.QueryHistoryPreference `json:"queryHistory,omitempty"`
	Locale       string                       `json:"locale"`
}

// swagger:model
type PatchPrefsCmd struct {
	// Enum: light,dark
	Theme *string `json:"theme,omitempty"`
	// The numerical :id of a favorited dashboard
	// Default:0
	HomeDashboardID *int64 `json:"homeDashboardId,omitempty"`
	// Enum: utc,browser
	Timezone         *string                      `json:"timezone,omitempty"`
	WeekStart        *string                      `json:"weekStart,omitempty"`
	Locale           *string                      `json:"locale,omitempty"`
	Navbar           *pref.NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     *pref.QueryHistoryPreference `json:"queryHistory,omitempty"`
	HomeDashboardUID *string                      `json:"homeDashboardUID,omitempty"`
}

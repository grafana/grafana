package dtos

import (
	pref "github.com/grafana/grafana/pkg/services/preference"
)

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
	Language     string                       `json:"language"`
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
	Language         *string                      `json:"language,omitempty"`
	Navbar           *pref.NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     *pref.QueryHistoryPreference `json:"queryHistory,omitempty"`
	HomeDashboardUID *string                      `json:"homeDashboardUID,omitempty"`
}

package dtos

import "github.com/grafana/grafana/pkg/models"

type Prefs struct {
	Theme           string                    `json:"theme"`
	HomeDashboardID int64                     `json:"homeDashboardId"`
	Timezone        string                    `json:"timezone"`
	WeekStart       string                    `json:"weekStart"`
	Navbar          []models.NavbarPreference `json:"navbar,omitempty"`
}

// swagger:model
type UpdatePrefsCmd struct {
	// Enum: light,dark
	Theme string `json:"theme"`
	// The numerical :id of a favorited dashboard
	// Default:0
	HomeDashboardID int64 `json:"homeDashboardId"`
	// Enum: utc,browser
	Timezone  string                     `json:"timezone"`
	WeekStart string                     `json:"weekStart"`
	Navbar    *[]models.NavbarPreference `json:"navbar,omitempty"`
}

type PatchPrefsCmd struct {
	Theme           *string                    `json:"theme,omitempty"`
	HomeDashboardID *int64                     `json:"homeDashboardId,omitempty"`
	Timezone        *string                    `json:"timezone,omitempty"`
	WeekStart       *string                    `json:"weekStart,omitempty"`
	Navbar          *[]models.NavbarPreference `json:"navbar,omitempty"`
}

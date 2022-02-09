package dtos

type Prefs struct {
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
	WeekStart       string `json:"weekStart"`
}

// swagger:model
type UpdatePrefsCmd struct {
	// Enum: light,dark
	Theme string `json:"theme"`
	// The numerical :id of a favorited dashboard
	// Default:0
	HomeDashboardID int64 `json:"homeDashboardId"`
	// Enum: utc,browser
	Timezone  string `json:"timezone"`
	WeekStart string `json:"weekStart"`
}

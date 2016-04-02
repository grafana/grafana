package dtos

type UserPrefs struct {
	Theme                  string `json:"theme"`
	ThemeDefault           string `json:"themeDefault"`
	HomeDashboardId        int64  `json:"homeDashboardId"`
	HomeDashboardIdDefault int64  `json:"homeDashboardIdDefault"`
	Timezone               string `json:"timezone"`
	TimezoneDefault        string `json:"timezoneDefault"`
}

type UpdateUserPrefsCmd struct {
	Theme           string `json:"theme"`
	HomeDashboardId int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
}

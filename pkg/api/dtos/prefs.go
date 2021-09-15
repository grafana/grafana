package dtos

type Prefs struct {
	NavPosition     string `json:"navPosition"`
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
}

type UpdatePrefsCmd struct {
	NavPosition     string `json:"navPosition"`
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
}

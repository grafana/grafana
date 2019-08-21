package dtos

type Prefs struct {
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
	MonthDayFormat  string `json:"monthDayFormat"`
}

type UpdatePrefsCmd struct {
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
	MonthDayFormat  string `json:"monthDayFormat"`
}

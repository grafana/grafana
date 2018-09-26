package dtos

type Prefs struct {
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	MonthDayFormat  string `json:"monthDayFormat"`
	Timezone        string `json:"timezone"`
}

type UpdatePrefsCmd struct {
	Theme           string `json:"theme"`
	HomeDashboardID int64  `json:"homeDashboardId"`
	MonthDayFormat  string `json:"monthDayFormat"`
	Timezone        string `json:"timezone"`
}

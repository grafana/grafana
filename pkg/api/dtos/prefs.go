package dtos

type Preferences struct {
	Theme           string `json:"theme"`
	HomeDashboardId int64  `json:"homeDashboardId"`
	Timezone        string `json:"timezone"`
}

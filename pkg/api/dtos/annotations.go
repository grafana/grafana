package dtos

import "github.com/grafana/grafana/pkg/components/simplejson"

type Annotation struct {
	AlertId     int64  `json:"alertId"`
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	NewState    string `json:"newState"`
	PrevState   string `json:"prevState"`
	Time        int64  `json:"time"`
	Title       string `json:"title"`
	Text        string `json:"text"`
	Metric      string `json:"metric"`
	RegionId    int64  `json:"regionId"`
	Type        string `json:"type"`

	Data *simplejson.Json `json:"data"`
}

type PostAnnotationsCmd struct {
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	CategoryId  int64  `json:"categoryId"`
	Time        int64  `json:"time"`
	Title       string `json:"title"`
	Text        string `json:"text"`

	FillColor string `json:"fillColor"`
	IsRegion  bool   `json:"isRegion"`
	TimeEnd   int64  `json:"timeEnd"`
}

type DeleteAnnotationsCmd struct {
	AlertId     int64 `json:"alertId"`
	DashboardId int64 `json:"dashboardId"`
	PanelId     int64 `json:"panelId"`
}

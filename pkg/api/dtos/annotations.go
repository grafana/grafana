package dtos

import "github.com/grafana/grafana/pkg/components/simplejson"

type Annotation struct {
	AnnotationId int64  `json:"annotationId"`
	AlertId      int64  `json:"alertId"`
	DashboardId  int64  `json:"dashboardId"`
	PanelId      int64  `json:"panelId"`
	UserId       int64  `json:"userId"`
	UserName     string `json:"userName"`
	NewState     string `json:"newState"`
	PrevState    string `json:"prevState"`
	Time         int64  `json:"time"`
	Title        string `json:"title"`
	Text         string `json:"text"`
	Metric       string `json:"metric"`
	RegionId     int64  `json:"regionId"`
	Type         string `json:"type"`

	Data *simplejson.Json `json:"data"`
}

type PostAnnotationsCmd struct {
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	Time        int64  `json:"time"`
	Title       string `json:"title"`
	Text        string `json:"text"`

	FillColor string `json:"fillColor"`
	IsRegion  bool   `json:"isRegion"`
	TimeEnd   int64  `json:"timeEnd"`
}

type UpdateAnnotationsCmd struct {
	AnnotationId int64  `json:"annotationId"`
	Time         int64  `json:"time"`
	Title        string `json:"title"`
	Text         string `json:"text"`
	Icon         string `json:"icon"`

	FillColor string `json:"fillColor"`
	IsRegion  bool   `json:"isRegion"`
	TimeEnd   int64  `json:"timeEnd"`
}

type DeleteAnnotationsCmd struct {
	AlertId      int64 `json:"alertId"`
	DashboardId  int64 `json:"dashboardId"`
	PanelId      int64 `json:"panelId"`
	AnnotationId int64 `json:"annotationId"`
	RegionId     int64 `json:"regionId"`
}

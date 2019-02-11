package dtos

import "github.com/grafana/grafana/pkg/components/simplejson"

type PostAnnotationsCmd struct {
	DashboardId int64            `json:"dashboardId"`
	PanelId     int64            `json:"panelId"`
	Time        int64            `json:"time"`
	Text        string           `json:"text"`
	Tags        []string         `json:"tags"`
	Data        *simplejson.Json `json:"data"`
	IsRegion    bool             `json:"isRegion"`
	TimeEnd     int64            `json:"timeEnd"`
}

type UpdateAnnotationsCmd struct {
	Id       int64    `json:"id"`
	Time     int64    `json:"time"`
	Text     string   `json:"text"`
	Tags     []string `json:"tags"`
	IsRegion bool     `json:"isRegion"`
	TimeEnd  int64    `json:"timeEnd"`
}

type PatchAnnotationsCmd struct {
	Id      int64    `json:"id"`
	Time    int64    `json:"time"`
	Text    string   `json:"text"`
	Tags    []string `json:"tags"`
	TimeEnd int64    `json:"timeEnd"`
}

type DeleteAnnotationsCmd struct {
	AlertId      int64 `json:"alertId"`
	DashboardId  int64 `json:"dashboardId"`
	PanelId      int64 `json:"panelId"`
	AnnotationId int64 `json:"annotationId"`
	RegionId     int64 `json:"regionId"`
}

type PostGraphiteAnnotationsCmd struct {
	When int64       `json:"when"`
	What string      `json:"what"`
	Data string      `json:"data"`
	Tags interface{} `json:"tags"`
}

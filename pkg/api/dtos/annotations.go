package dtos

import "github.com/grafana/grafana/pkg/components/simplejson"

type PostAnnotationsCmd struct {
	DashboardId  int64  `json:"dashboardId"`
	DashboardUID string `json:"dashboardUID,omitempty"`
	PanelId      int64  `json:"panelId"`
	Time         int64  `json:"time"`
	TimeEnd      int64  `json:"timeEnd,omitempty"` // Optional
	// required: true
	Text string           `json:"text"`
	Tags []string         `json:"tags"`
	Data *simplejson.Json `json:"data"`
}

type UpdateAnnotationsCmd struct {
	Id      int64            `json:"id"`
	Time    int64            `json:"time"`
	TimeEnd int64            `json:"timeEnd,omitempty"` // Optional
	Text    string           `json:"text"`
	Tags    []string         `json:"tags"`
	Data    *simplejson.Json `json:"data"`
}

type PatchAnnotationsCmd struct {
	Id      int64            `json:"id"`
	Time    int64            `json:"time"`
	TimeEnd int64            `json:"timeEnd,omitempty"` // Optional
	Text    string           `json:"text"`
	Tags    []string         `json:"tags"`
	Data    *simplejson.Json `json:"data"`
}

type MassDeleteAnnotationsCmd struct {
	DashboardId  int64  `json:"dashboardId"`
	PanelId      int64  `json:"panelId"`
	AnnotationId int64  `json:"annotationId"`
	DashboardUID string `json:"dashboardUID,omitempty"`
}

type PostGraphiteAnnotationsCmd struct {
	When int64       `json:"when"`
	What string      `json:"what"`
	Data string      `json:"data"`
	Tags interface{} `json:"tags"`
}

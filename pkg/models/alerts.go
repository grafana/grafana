package models

import (
//"github.com/grafana/grafana/pkg/components/simplejson"
)

type Alert struct {
	Id            int64
	DashboardId   int64
	PanelId       int64
	Query         string
	QueryRefId    string
	WarnLevel     int64
	ErrorLevel    int64
	CheckInterval string
	Title         string
	Description   string
	QueryRange    string
}

func (cmd *SaveDashboardCommand) GetAlertModels() *[]Alert {
	dash := NewDashboardFromJson(cmd.Dashboard)

	alerts := make([]Alert, 0)

	alerts = append(alerts, Alert{
		DashboardId:   dash.Id,
		Id:            1,
		PanelId:       1,
		Query:         "",
		QueryRefId:    "",
		WarnLevel:     0,
		ErrorLevel:    0,
		CheckInterval: "5s",
		Title:         dash.Title + " Alert",
		Description:   dash.Title + " Description",
		QueryRange:    "10m",
	})

	return &alerts
}

// Commands
type SaveAlertsCommand struct {
	DashboardId int64
	UserId      int64
	OrgId       int64

	Alerts *[]Alert
}

package models

import (
//"github.com/grafana/grafana/pkg/components/simplejson"
)

type Alert struct {
	Id          int64
	DashboardId int64
	PanelId     int64
	Query       string
	QueryRefId  string
	WarnLevel   int64
	ErrorLevel  int64
	Interval    string
	Title       string
	Description string
	QueryRange  string
	Aggregator  string
}

func (cmd *SaveDashboardCommand) GetAlertModels() *[]Alert {
	dash := NewDashboardFromJson(cmd.Dashboard)

	alerts := make([]Alert, 0)

	alerts = append(alerts, Alert{
		DashboardId: dash.Id,
		Id:          1,
		PanelId:     1,
		Query:       "query",
		QueryRefId:  "query_ref",
		WarnLevel:   0,
		ErrorLevel:  0,
		Interval:    "5s",
		Title:       dash.Title + " Alert",
		Description: dash.Title + " Description",
		QueryRange:  "10m",
		Aggregator:  "avg",
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

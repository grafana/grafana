package models

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type Alert struct {
	Id          int64
	DashboardId int64
	PanelId     int64
	Query       string
	QueryRefId  string
	WarnLevel   int64
	ErrorLevel  int64
	Interval    int64
	Title       string
	Description string
	QueryRange  string
	Aggregator  string
}

func (cmd *SaveDashboardCommand) GetAlertModels() *[]Alert {
	dash := NewDashboardFromJson(cmd.Dashboard)
	alerts := make([]Alert, 0)

	for _, rowObj := range cmd.Dashboard.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)

			for _, alertObj := range panel.Get("alerts").MustArray() {
				alertDef := simplejson.NewFromAny(alertObj)

				alert := Alert{
					DashboardId: dash.Id,
					PanelId:     panel.Get("id").MustInt64(),
					Id:          alertDef.Get("id").MustInt64(),
					Query:       alertDef.Get("query").MustString(),
					QueryRefId:  alertDef.Get("query_ref").MustString(),
					WarnLevel:   alertDef.Get("warn_level").MustInt64(),
					ErrorLevel:  alertDef.Get("error_level").MustInt64(),
					Interval:    alertDef.Get("interval").MustInt64(),
					Title:       alertDef.Get("title").MustString(),
					Description: alertDef.Get("description").MustString(),
					QueryRange:  alertDef.Get("query_range").MustString(),
					Aggregator:  alertDef.Get("aggregator").MustString(),
				}

				alerts = append(alerts, alert)
			}
		}
	}

	return &alerts
}

// Commands
type SaveAlertsCommand struct {
	DashboardId int64
	UserId      int64
	OrgId       int64

	Alerts *[]Alert
}

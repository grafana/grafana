package models

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"time"
)

type AlertRule struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	Query       string
	QueryRefId  string
	WarnLevel   string
	CritLevel   string
	Interval    string
	Title       string
	Description string
	QueryRange  string
	Aggregator  string
}

type AlertRuleChange struct {
	OrgId   int64
	AlertId int64
	Type    string
	Created time.Time
}

func (cmd *SaveDashboardCommand) GetAlertModels() *[]AlertRule {
	alerts := make([]AlertRule, 0)

	for _, rowObj := range cmd.Dashboard.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)

			alerting := panel.Get("alerting")
			alert := AlertRule{
				DashboardId: cmd.Result.Id,
				OrgId:       cmd.Result.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          alerting.Get("id").MustInt64(),
				QueryRefId:  alerting.Get("query_ref").MustString(),
				WarnLevel:   alerting.Get("warn_level").MustString(),
				CritLevel:   alerting.Get("crit_level").MustString(),
				Interval:    alerting.Get("interval").MustString(),
				Title:       alerting.Get("title").MustString(),
				Description: alerting.Get("description").MustString(),
				QueryRange:  alerting.Get("query_range").MustString(),
				Aggregator:  alerting.Get("aggregator").MustString(),
			}

			for _, targetsObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetsObj)

				if target.Get("refId").MustString() == alert.QueryRefId {
					alert.Query = target.Get("target").MustString()
					continue
				}
			}

			if alert.Query != "" {
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

	Alerts *[]AlertRule
}

package models

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"time"
)

type AlertRule struct {
	Id          int64  `json:"id"`
	OrgId       int64  `json:"-"`
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	Query       string `json:"query"`
	QueryRefId  string `json:"queryRefId"`
	WarnLevel   string `json:"warnLevel"`
	CritLevel   string `json:"critLevel"`
	Interval    string `json:"interval"`
	Title       string `json:"title"`
	Description string `json:"description"`
	QueryRange  string `json:"queryRange"`
	Aggregator  string `json:"aggregator"`
	State       string `json:"state"`
}

type AlertRuleChange struct {
	OrgId   int64     `json:"-"`
	AlertId int64     `json:"alertId"`
	Type    string    `json:"type"`
	Created time.Time `json:"created"`
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
				QueryRefId:  alerting.Get("queryRef").MustString(),
				WarnLevel:   alerting.Get("warnLevel").MustString(),
				CritLevel:   alerting.Get("critLevel").MustString(),
				Interval:    alerting.Get("interval").MustString(),
				Title:       alerting.Get("title").MustString(),
				Description: alerting.Get("description").MustString(),
				QueryRange:  alerting.Get("queryRange").MustString(),
				Aggregator:  alerting.Get("aggregator").MustString(),
			}

			for _, targetsObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetsObj)

				if target.Get("refId").MustString() == alert.QueryRefId {
					targetJson, err := target.MarshalJSON()
					if err == nil {
						alert.Query = string(targetJson)
					}
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

//Queries
type GetAlertsQuery struct {
	OrgId int64

	Result []AlertRule
}

type GetAlertByIdQuery struct {
	Id int64

	Result AlertRule
}

type GetAlertChangesQuery struct {
	OrgId int64

	Result []AlertRuleChange
}

type GetAlertsForDashboardQuery struct {
	DashboardId int64

	Result []AlertRule
}

type GetAlertForPanelQuery struct {
	DashboardId int64
	PanelId     int64

	Result AlertRule
}

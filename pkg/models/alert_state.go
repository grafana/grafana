package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
)

type AlertState struct {
	Id              int64            `json:"-"`
	OrgId           int64            `json:"-"`
	AlertId         int64            `json:"alertId"`
	NewState        string           `json:"newState"`
	Created         time.Time        `json:"created"`
	Info            string           `json:"info"`
	TriggeredAlerts *simplejson.Json `json:"triggeredAlerts"`
}

func (this *UpdateAlertStateCommand) IsValidState() bool {
	for _, v := range alertstates.ValidStates {
		if this.NewState == v {
			return true
		}
	}
	return false
}

// Commands

type UpdateAlertStateCommand struct {
	AlertId         int64            `json:"alertId" binding:"Required"`
	OrgId           int64            `json:"orgId" binding:"Required"`
	NewState        string           `json:"newState" binding:"Required"`
	Info            string           `json:"info"`
	TriggeredAlerts *simplejson.Json `json:"triggeredAlerts"`

	Result *Alert
}

// Queries

type GetAlertsStateQuery struct {
	OrgId   int64 `json:"orgId" binding:"Required"`
	AlertId int64 `json:"alertId" binding:"Required"`

	Result *[]AlertState
}

type GetLastAlertStateQuery struct {
	AlertId int64
	OrgId   int64

	Result *AlertState
}

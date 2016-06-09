package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertRule struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	Name        string
	Description string
	State       string

	Created time.Time
	Updated time.Time

	Expression *simplejson.Json
}

func (alertRule *AlertRule) ValidToSave() bool {
	return true
}

func (this *AlertRule) ContainsUpdates(other *AlertRule) bool {
	result := false

	result = result || this.Name != other.Name
	result = result || this.Description != other.Description

	json1, err1 := this.Expression.MarshalJSON()
	json2, err2 := other.Expression.MarshalJSON()

	if err1 != nil || err2 != nil {
		return false
	}

	result = result || string(json1) != string(json2)

	//don't compare .State! That would be insane.

	return result
}

type AlertingClusterInfo struct {
	ServerId       string
	ClusterSize    int
	UptimePosition int
}

type HeartBeat struct {
	Id       int64
	ServerId string
	Updated  time.Time
	Created  time.Time
}

type HeartBeatCommand struct {
	ServerId string

	Result AlertingClusterInfo
}

type AlertRuleChange struct {
	Id      int64     `json:"id"`
	OrgId   int64     `json:"-"`
	AlertId int64     `json:"alertId"`
	Type    string    `json:"type"`
	Created time.Time `json:"created"`
}

// Commands
type SaveAlertsCommand struct {
	DashboardId int64
	UserId      int64
	OrgId       int64

	Alerts []*AlertRule
}

type DeleteAlertCommand struct {
	AlertId int64
}

//Queries
type GetAlertsQuery struct {
	OrgId       int64
	State       []string
	DashboardId int64
	PanelId     int64

	Result []*AlertRule
}

type GetAllAlertsQuery struct {
	Result []*AlertRule
}

type GetAlertsForExecutionQuery struct {
	Timestamp int64

	Result []*AlertRule
}

type GetAlertByIdQuery struct {
	Id int64

	Result *AlertRule
}

type GetAlertChangesQuery struct {
	OrgId   int64
	Limit   int64
	SinceId int64

	Result []*AlertRuleChange
}

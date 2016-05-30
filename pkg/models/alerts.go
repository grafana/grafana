package models

import (
	"time"
)

type AlertRule struct {
	Id           int64  `json:"id"`
	OrgId        int64  `json:"-"`
	DatasourceId int64  `json:"datasourceId"`
	DashboardId  int64  `json:"dashboardId"`
	PanelId      int64  `json:"panelId"`
	Query        string `json:"query"`
	QueryRefId   string `json:"queryRefId"`
	WarnLevel    int64  `json:"warnLevel"`
	CritLevel    int64  `json:"critLevel"`
	WarnOperator string `json:"warnOperator"`
	CritOperator string `json:"critOperator"`
	Frequency    int64  `json:"frequency"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	QueryRange   int    `json:"queryRange"`
	Aggregator   string `json:"aggregator"`
	State        string `json:"state"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

type AlertingClusterInfo struct {
	ServerId       string
	ClusterSize    int
	UptimePosition int
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

	Alerts []AlertRule
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

	Result []AlertRule
}

type GetAlertsForExecutionQuery struct {
	Timestamp int64

	Result []AlertRule
}

type GetAlertByIdQuery struct {
	Id int64

	Result AlertRule
}

type GetAlertChangesQuery struct {
	OrgId   int64
	Limit   int64
	SinceId int64

	Result []AlertRuleChange
}

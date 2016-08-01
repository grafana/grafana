package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertStateType string
type AlertSeverityType string

const (
	AlertStatePending AlertStateType = "pending"
	AlertStateFiring  AlertStateType = "firing"
	AlertStateOK      AlertStateType = "ok"
)

func (s AlertStateType) IsValid() bool {
	return s == AlertStatePending || s == AlertStateFiring || s == AlertStateOK
}

const (
	AlertSeverityCritical AlertSeverityType = "critical"
	AlertSeverityWarning  AlertSeverityType = "warning"
	AlertSeverityInfo     AlertSeverityType = "info"
	AlertSeverityOK       AlertSeverityType = "ok"
)

func (s AlertSeverityType) IsValid() bool {
	return s == AlertSeverityCritical || s == AlertSeverityInfo || s == AlertSeverityWarning
}

type Alert struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	Name        string
	Description string
	Severity    AlertSeverityType
	State       AlertStateType
	Handler     int64
	Enabled     bool
	Frequency   int64

	CreatedBy int64
	UpdatedBy int64

	Created time.Time
	Updated time.Time

	Settings *simplejson.Json
}

func (alert *Alert) ValidToSave() bool {
	return alert.DashboardId != 0 && alert.OrgId != 0 && alert.PanelId != 0
}

func (alert *Alert) ShouldUpdateState(newState AlertStateType) bool {
	return alert.State != newState
}

func (this *Alert) ContainsUpdates(other *Alert) bool {
	result := false
	result = result || this.Name != other.Name
	result = result || this.Description != other.Description

	if this.Settings != nil && other.Settings != nil {
		json1, err1 := this.Settings.Encode()
		json2, err2 := other.Settings.Encode()

		if err1 != nil || err2 != nil {
			return false
		}

		result = result || string(json1) != string(json2)
	}

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
	Result   AlertingClusterInfo
}

type SaveAlertsCommand struct {
	DashboardId int64
	UserId      int64
	OrgId       int64

	Alerts []*Alert
}

type SetAlertStateCommand struct {
	AlertId   int64
	OrgId     int64
	State     AlertStateType
	Timestamp time.Time
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

	Result []*Alert
}

type GetAllAlertsQuery struct {
	Result []*Alert
}

type GetAlertByIdQuery struct {
	Id int64

	Result *Alert
}

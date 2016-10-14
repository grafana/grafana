package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertStateType string
type AlertSeverityType string

const (
	AlertStateNoData    AlertStateType = "no_data"
	AlertStateExecError AlertStateType = "execution_error"
	AlertStatePaused    AlertStateType = "paused"
	AlertStateAlerting  AlertStateType = "alerting"
	AlertStateOK        AlertStateType = "ok"
)

func (s AlertStateType) IsValid() bool {
	return s == AlertStateOK || s == AlertStateNoData || s == AlertStateExecError || s == AlertStatePaused
}

type Alert struct {
	Id             int64
	Version        int64
	OrgId          int64
	DashboardId    int64
	PanelId        int64
	Name           string
	Message        string
	Severity       string
	State          AlertStateType
	Handler        int64
	Silenced       bool
	ExecutionError string
	Frequency      int64

	EvalData     *simplejson.Json
	EvalDate     time.Time
	NewStateDate time.Time
	StateChanges int

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
	result = result || this.Message != other.Message

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

type PauseAlertCommand struct {
	OrgId   int64
	AlertId int64
	Paused  bool
}

type SetAlertStateCommand struct {
	AlertId  int64
	OrgId    int64
	State    AlertStateType
	Error    string
	EvalData *simplejson.Json

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
	Limit       int64

	Result []*Alert
}

type GetAllAlertsQuery struct {
	Result []*Alert
}

type GetAlertByIdQuery struct {
	Id int64

	Result *Alert
}

type GetAlertStatesForDashboardQuery struct {
	OrgId       int64
	DashboardId int64

	Result []*AlertStateInfoDTO
}

type AlertStateInfoDTO struct {
	Id           int64          `json:"id"`
	DashboardId  int64          `json:"dashboardId"`
	PanelId      int64          `json:"panelId"`
	State        AlertStateType `json:"state"`
	NewStateDate time.Time      `json:"newStateDate"`
}

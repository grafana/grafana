package models

import (
	"time"
)

type AlertStateLog struct {
	Id       int64     `json:"-"`
	OrgId    int64     `json:"-"`
	AlertId  int64     `json:"alertId"`
	NewState string    `json:"newState"`
	Created  time.Time `json:"created"`
	Info     string    `json:"info"`
}

var (
	ALERT_STATE_OK           = "OK"
	ALERT_STATE_ALERT        = "ALERT"
	ALERT_STATE_WARN         = "WARN"
	ALERT_STATE_ACKNOWLEDGED = "ACKNOWLEDGED"
)

func (this *UpdateAlertStateCommand) IsValidState() bool {
	return this.NewState == ALERT_STATE_OK || this.NewState == ALERT_STATE_WARN || this.NewState == ALERT_STATE_ALERT || this.NewState == ALERT_STATE_ACKNOWLEDGED
}

// Commands

type UpdateAlertStateCommand struct {
	AlertId  int64  `json:"alertId" binding:"Required"`
	NewState string `json:"newState" binding:"Required"`
	Info     string `json:"info"`

	Result *AlertRule
}

// Queries

type GetAlertsStateLogCommand struct {
	OrgId   int64 `json:"orgId" binding:"Required"`
	AlertId int64 `json:"alertId" binding:"Required"`

	Result *[]AlertStateLog
}

package models

import (
	"time"
)

type AlertState struct {
	Id       int64     `json:"-"`
	OrgId    int64     `json:"-"`
	AlertId  int64     `json:"alertId"`
	NewState string    `json:"newState"`
	Created  time.Time `json:"created"`
	Info     string    `json:"info"`
}

var (
	VALID_STATES = []string{
		ALERT_STATE_OK,
		ALERT_STATE_WARN,
		ALERT_STATE_CRITICAL,
		ALERT_STATE_ACKNOWLEDGED,
		ALERT_STATE_MAINTENANCE,
	}

	ALERT_STATE_OK           = "OK"
	ALERT_STATE_WARN         = "WARN"
	ALERT_STATE_CRITICAL     = "CRITICAL"
	ALERT_STATE_ACKNOWLEDGED = "ACKNOWLEDGED"
	ALERT_STATE_MAINTENANCE  = "MAINTENANCE"
)

func (this *UpdateAlertStateCommand) IsValidState() bool {
	for _, v := range VALID_STATES {
		if this.NewState == v {
			return true
		}
	}
	return false
}

// Commands

type UpdateAlertStateCommand struct {
	AlertId  int64  `json:"alertId" binding:"Required"`
	NewState string `json:"newState" binding:"Required"`
	Info     string `json:"info"`

	Result *AlertRule
}

// Queries

type GetAlertsStateQuery struct {
	OrgId   int64 `json:"orgId" binding:"Required"`
	AlertId int64 `json:"alertId" binding:"Required"`

	Result *[]AlertState
}

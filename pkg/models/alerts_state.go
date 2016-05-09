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
	VALID_STATES = []string{"OK", "WARN", "CRITICAL", "ACKNOWLEDGED"}
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

type GetAlertsStateCommand struct {
	OrgId   int64 `json:"orgId" binding:"Required"`
	AlertId int64 `json:"alertId" binding:"Required"`

	Result *[]AlertState
}

package models

import "time"

type AlertStateLog struct {
	Id           int64     `json:"id"`
	OrgId        int64     `json:"-"`
	AlertId      int64     `json:"alertId"`
	State        string    `json:"type"`
	Created      time.Time `json:"created"`
	Acknowledged time.Time `json:"acknowledged"`
	Deleted      time.Time `json:"deleted"`
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

type UpdateAlertStateCommand struct {
	AlertId  int64  `json:"alertId" binding:"Required"`
	NewState string `json:"newState" binding:"Required"`
	Info     string `json:"info"`

	Result *AlertRule
}

package dtos

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type AlertRule struct {
	Id             int64                 `json:"id"`
	DashboardId    int64                 `json:"dashboardId"`
	PanelId        int64                 `json:"panelId"`
	Name           string                `json:"name"`
	Message        string                `json:"message"`
	State          models.AlertStateType `json:"state"`
	NewStateDate   time.Time             `json:"newStateDate"`
	EvalDate       time.Time             `json:"evalDate"`
	EvalData       *simplejson.Json      `json:"evalData"`
	ExecutionError string                `json:"executionError"`
	Url            string                `json:"url"`
	CanEdit        bool                  `json:"canEdit"`
}

func removeZeroesFromDuration(interval time.Duration) string {
	frequency := interval.String()

	frequency = strings.Replace(frequency, "0h", "", 1)
	frequency = strings.Replace(frequency, "0m", "", 1)
	frequency = strings.Replace(frequency, "0s", "", 1)

	return frequency
}

func NewAlertNotification(notification *models.AlertNotification) *AlertNotification {
	return &AlertNotification{
		Id:         notification.Id,
		Name:       notification.Name,
		Type:       notification.Type,
		IsDefault:  notification.IsDefault,
		Created:    notification.Created,
		Updated:    notification.Updated,
		Frequency:  removeZeroesFromDuration(notification.Frequency),
		NotifyOnce: notification.NotifyOnce,
		Settings:   notification.Settings,
	}
}

type AlertNotification struct {
	Id         int64            `json:"id"`
	Name       string           `json:"name"`
	Type       string           `json:"type"`
	IsDefault  bool             `json:"isDefault"`
	NotifyOnce bool             `json:"notifyOnce"`
	Frequency  string           `json:"frequency"`
	Created    time.Time        `json:"created"`
	Updated    time.Time        `json:"updated"`
	Settings   *simplejson.Json `json:"settings"`
}

type AlertTestCommand struct {
	Dashboard *simplejson.Json `json:"dashboard" binding:"Required"`
	PanelId   int64            `json:"panelId" binding:"Required"`
}

type AlertTestResult struct {
	Firing         bool                  `json:"firing"`
	State          models.AlertStateType `json:"state"`
	ConditionEvals string                `json:"conditionEvals"`
	TimeMs         string                `json:"timeMs"`
	Error          string                `json:"error,omitempty"`
	EvalMatches    []*EvalMatch          `json:"matches,omitempty"`
	Logs           []*AlertTestResultLog `json:"logs,omitempty"`
}

type AlertTestResultLog struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type EvalMatch struct {
	Tags   map[string]string `json:"tags,omitempty"`
	Metric string            `json:"metric"`
	Value  null.Float        `json:"value"`
}

type NotificationTestCommand struct {
	Name       string           `json:"name"`
	Type       string           `json:"type"`
	NotifyOnce bool             `json:"notifyOnce"`
	Frequency  string           `json:"frequency"`
	Settings   *simplejson.Json `json:"settings"`
}

type PauseAlertCommand struct {
	AlertId int64 `json:"alertId"`
	Paused  bool  `json:"paused"`
}

type PauseAllAlertsCommand struct {
	Paused bool `json:"paused"`
}

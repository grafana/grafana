package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertRule struct {
	Id             int64            `json:"id"`
	DashboardId    int64            `json:"dashboardId"`
	PanelId        int64            `json:"panelId"`
	Name           string           `json:"name"`
	Message        string           `json:"message"`
	State          m.AlertStateType `json:"state"`
	NewStateDate   time.Time        `json:"newStateDate"`
	EvalDate       time.Time        `json:"evalDate"`
	EvalData       *simplejson.Json `json:"evalData"`
	ExecutionError string           `json:"executionError"`
	Url            string           `json:"url"`
	CanEdit        bool             `json:"canEdit"`
}

type AlertNotification struct {
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	IsDefault bool      `json:"isDefault"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

type AlertTestCommand struct {
	Dashboard *simplejson.Json `json:"dashboard" binding:"Required"`
	PanelId   int64            `json:"panelId" binding:"Required"`
}

type AlertTestResult struct {
	Firing         bool                  `json:"firing"`
	State          m.AlertStateType      `json:"state"`
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
	Name     string           `json:"name"`
	Type     string           `json:"type"`
	Settings *simplejson.Json `json:"settings"`
}

type PauseAlertCommand struct {
	AlertId int64 `json:"alertId"`
	Paused  bool  `json:"paused"`
}

type PauseAllAlertsCommand struct {
	Paused bool `json:"paused"`
}

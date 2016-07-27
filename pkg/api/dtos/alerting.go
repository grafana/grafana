package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertRule struct {
	Id          int64               `json:"id"`
	DashboardId int64               `json:"dashboardId"`
	PanelId     int64               `json:"panelId"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	State       m.AlertStateType    `json:"state"`
	Severity    m.AlertSeverityType `json:"severity"`

	DashbboardUri string `json:"dashboardUri"`
}

type AlertNotification struct {
	Id      int64     `json:"id"`
	Name    string    `json:"name"`
	Type    string    `json:"type"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

type AlertTestCommand struct {
	Dashboard *simplejson.Json `json:"dashboard" binding:"Required"`
	PanelId   int64            `json:"panelId" binding:"Required"`
}

type AlertTestResult struct {
	Firing bool                  `json:"firing"`
	TimeMs string                `json:"timeMs"`
	Error  string                `json:"error,omitempty"`
	Logs   []*AlertTestResultLog `json:"logs,omitempty"`
}

type AlertTestResultLog struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type AlertEvent struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
}

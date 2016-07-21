package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertRuleDTO struct {
	Id           int64   `json:"id"`
	DashboardId  int64   `json:"dashboardId"`
	PanelId      int64   `json:"panelId"`
	Query        string  `json:"query"`
	QueryRefId   string  `json:"queryRefId"`
	WarnLevel    float64 `json:"warnLevel"`
	CritLevel    float64 `json:"critLevel"`
	WarnOperator string  `json:"warnOperator"`
	CritOperator string  `json:"critOperator"`
	Frequency    int64   `json:"frequency"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	QueryRange   int     `json:"queryRange"`
	Aggregator   string  `json:"aggregator"`
	State        string  `json:"state"`

	DashbboardUri string `json:"dashboardUri"`
}

type AlertNotificationDTO struct {
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
	Triggered bool                  `json:"triggerd"`
	Timing    string                `json:"timing"`
	Error     string                `json:"error,omitempty"`
	Logs      []*AlertTestResultLog `json:"logs,omitempty"`
}

type AlertTestResultLog struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

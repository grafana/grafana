package models

import (
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type DashboardUpgrade struct {
	ID             int64
	UID            string
	Title          string
	FolderID       int64
	MigratedAlerts map[int64]*AlertPair
	NewFolderUID   string
	CreatedFolder  bool
	Warning        string
}

type AlertPair struct {
	LegacyRule *legacymodels.Alert
	Rule       *ngmodels.AlertRule
	Error      string
}

type ContactPair struct {
	Channel      *legacymodels.AlertNotification
	ContactPoint *apiModels.PostableGrafanaReceiver
	Route        *apiModels.Route
	Error        string
}

func NewAlertPair(da *legacymodels.Alert, err error) *AlertPair {
	pair := &AlertPair{
		LegacyRule: da,
	}
	if err != nil {
		pair.Error = err.Error()
	}
	return pair
}

func NewDashboardUpgrade(id int64) *DashboardUpgrade {
	return &DashboardUpgrade{
		ID:             id,
		MigratedAlerts: make(map[int64]*AlertPair),
	}
}

func (du *DashboardUpgrade) AddAlertErrors(err error, alerts ...*legacymodels.Alert) {
	for _, da := range alerts {
		pair := NewAlertPair(da, err)
		du.MigratedAlerts[da.PanelID] = pair
	}
}

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
}

type AlertPair struct {
	LegacyRule *legacymodels.Alert
	Rule       *ngmodels.AlertRule
}

type ContactPair struct {
	Channel      *legacymodels.AlertNotification
	ContactPoint *apiModels.PostableGrafanaReceiver
	Route        *apiModels.Route
}

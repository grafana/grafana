package models

import (
	"fmt"

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
}

type AlertPair struct {
	LegacyRule *legacymodels.Alert
	Rule       *ngmodels.AlertRule
	Error      error
}

type ContactPair struct {
	Channel      *legacymodels.AlertNotification
	ContactPoint *apiModels.PostableGrafanaReceiver
	Route        *apiModels.Route
	Error        error
}

func NewAlertPair(da *legacymodels.Alert, err error) *AlertPair {
	return &AlertPair{
		LegacyRule: da,
		Error:      err,
	}
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

// ExtractErrors extracts errors from migrated dashboards and channels.
func ExtractErrors(dus []*DashboardUpgrade, contactPairs []*ContactPair) []error {
	errs := make([]error, 0)
	for _, du := range dus {
		for _, pair := range du.MigratedAlerts {
			if pair.Error != nil {
				errs = append(errs, fmt.Errorf("migrate alert '%s': %w", pair.LegacyRule.Name, pair.Error))
			}
		}
	}
	for _, pair := range contactPairs {
		if pair.Error != nil {
			errs = append(errs, fmt.Errorf("migrate channel '%s': %w", pair.Channel.Name, pair.Error))
		}
	}
	return errs
}

package models

import (
	"errors"
	"fmt"

	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/migration/legacymodels"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

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

// ExtractErrors extracts errors from migrated dashboards and channels.
func ExtractErrors(alertPairs []*AlertPair, contactPairs []*ContactPair) error {
	var err error
	for _, pair := range alertPairs {
		if pair.Error != nil {
			err = errors.Join(err, fmt.Errorf("migrate alert '%s': %w", pair.LegacyRule.Name, pair.Error))
		}
	}
	for _, pair := range contactPairs {
		if pair.Error != nil {
			err = errors.Join(err, fmt.Errorf("migrate channel '%s': %w", pair.Channel.Name, pair.Error))
		}
	}
	return err
}

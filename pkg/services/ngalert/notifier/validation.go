package notifier

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type NotificationSettingsValidator struct {
	availableReceivers   map[string]struct{}
	availableMuteTimings map[string]struct{}
}

func NewNotificationSettingsValidator(am definitions.PostableApiAlertingConfig) NotificationSettingsValidator {
	availableReceivers := make(map[string]struct{}, len(am.Receivers))
	for _, receiver := range am.Receivers {
		availableReceivers[receiver.Name] = struct{}{}
	}
	availableMuteTimings := make(map[string]struct{}, len(am.MuteTimeIntervals))
	for _, interval := range am.MuteTimeIntervals {
		availableReceivers[interval.Name] = struct{}{}
	}
	return NotificationSettingsValidator{
		availableReceivers:   availableReceivers,
		availableMuteTimings: availableMuteTimings,
	}
}

// Validate checks that models.NotificationSettings is valid and refers to the available receiver and mute timings
func (n NotificationSettingsValidator) Validate(settings models.NotificationSettings) error {
	if err := settings.Validate(); err != nil {
		return err
	}
	var errs []error
	if _, ok := n.availableReceivers[settings.Receiver]; !ok {
		errs = append(errs, fmt.Errorf("receiver '%s' does not exist", settings.Receiver))
	}
	for _, interval := range settings.MuteTimeIntervals {
		if _, ok := n.availableMuteTimings[interval]; !ok {
			errs = append(errs, fmt.Errorf("mute time interval '%s' does not exist", interval))
		}
	}
	return errors.Join(errs...)
}

type noValidation struct {
}

func (n noValidation) Validate(_ models.NotificationSettings) error {
	return nil
}

type NotificationSettingsValidationService struct {
	store store.AlertingStore
}

func NewNotificationSettingsValidationService(store store.AlertingStore) *NotificationSettingsValidationService {
	return &NotificationSettingsValidationService{
		store: store,
	}
}

func (v *NotificationSettingsValidationService) Validator(ctx context.Context, orgID int64) (models.NotificationSettingsValidator, error) {
	rawCfg, err := v.store.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return NotificationSettingsValidator{}, err
	}
	cfg, err := Load([]byte(rawCfg.AlertmanagerConfiguration))
	if err != nil {
		return NotificationSettingsValidator{}, err
	}
	log.New("ngalert.notifier.validator").FromContext(ctx).Debug("Create validator from Alertmanager configuration", "hash", rawCfg.ConfigurationHash)
	return NewNotificationSettingsValidator(cfg.AlertmanagerConfig), nil
}

func (v *NotificationSettingsValidationService) Validate(ctx context.Context, orgID int64, settings []models.NotificationSettings) error {
	validator, err := v.Validator(ctx, orgID)
	if err != nil {
		return err
	}
	var errs []error
	for _, setting := range settings {
		if err := validator.Validate(setting); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

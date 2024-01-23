package notifier

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type notificaitonSettingsValidator interface {
	Validate(settings models.NotificationSettings) error
}

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

func NewNotificationSettingsValidatorFromGettable(am definitions.GettableApiAlertingConfig) NotificationSettingsValidator {
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

func (moa *MultiOrgAlertmanager) Validate(ctx context.Context, settings []models.NotificationSettings, user identity.Requester) error {
	cfg, err := moa.GetAlertmanagerConfiguration(ctx, user.GetOrgID(), false)
	if err != nil {
		return err
	}
	validator := NewNotificationSettingsValidatorFromGettable(cfg.AlertmanagerConfig)
	var errs []error
	for _, setting := range settings {
		if err := validator.Validate(setting); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

package notifier

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type NotificationSettingsValidator struct {
	availableReceivers   map[string]struct{}
	availableMuteTimings map[string]struct{}
}

// apiAlertingConfig contains the methods required to validate NotificationSettings and create autogen routes.
type apiAlertingConfig interface {
	ReceiverNames() map[string]struct{}
	MuteTimeIntervalNames() map[string]struct{}
	GetRoute() *definitions.Route
}

// NewNotificationSettingsValidator creates a new NotificationSettingsValidator from the given apiAlertingConfig.
func NewNotificationSettingsValidator(am apiAlertingConfig) NotificationSettingsValidator {
	return NotificationSettingsValidator{
		availableReceivers:   am.ReceiverNames(),
		availableMuteTimings: am.MuteTimeIntervalNames(),
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

type NotificationSettingsValidationService struct {
	store store.AlertingStore
}

func NewNotificationSettingsValidationService(store store.AlertingStore) *NotificationSettingsValidationService {
	return &NotificationSettingsValidationService{
		store: store,
	}
}

// Validator returns a NotificationSettingsValidator using the alertmanager configuration from the given orgID.
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
	return NewNotificationSettingsValidator(&cfg.AlertmanagerConfig), nil
}

// Validate checks that the given NotificationSettings are valid for the given orgID.
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

type CachedNotificationSettingsValidationService struct {
	srv        *NotificationSettingsValidationService
	mtx        sync.Mutex
	validators map[int64]models.NotificationSettingsValidator
}

func NewCachedNotificationSettingsValidationService(store store.AlertingStore) *CachedNotificationSettingsValidationService {
	return &CachedNotificationSettingsValidationService{
		srv:        NewNotificationSettingsValidationService(store),
		mtx:        sync.Mutex{},
		validators: map[int64]models.NotificationSettingsValidator{},
	}
}

// Validator returns a NotificationSettingsValidator using the alertmanager configuration from the given orgID.
func (v *CachedNotificationSettingsValidationService) Validator(ctx context.Context, orgID int64) (models.NotificationSettingsValidator, error) {
	v.mtx.Lock()
	defer v.mtx.Unlock()

	result, ok := v.validators[orgID]
	if !ok {
		vd, err := v.srv.Validator(ctx, orgID)
		if err != nil {
			return nil, err
		}
		v.validators[orgID] = vd
		result = vd
	}
	return result, nil
}

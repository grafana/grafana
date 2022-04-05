package notifier

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
)

type UnknownReceiverError struct {
	UID string
}

func (e UnknownReceiverError) Error() string {
	return fmt.Sprintf("unknown receiver: %s", e.UID)
}

type AlertmanagerConfigRejectedError struct {
	Inner error
}

func (e AlertmanagerConfigRejectedError) Error() string {
	return fmt.Sprintf("failed to save and apply Alertmanager configuration: %s", e.Inner.Error())
}

// AlertmanagerConfigService is a domain-layer service which manages configs for the Grafana alertmanager.
type AlertmanagerConfigService struct {
	mam     *MultiOrgAlertmanager
	secrets secrets.Service
	store   AlertingStore
	log     log.Logger
}

type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
}

func NewAlertmanagerConfigService(mam *MultiOrgAlertmanager, secrets secrets.Service, store AlertingStore, log log.Logger) *AlertmanagerConfigService {
	return &AlertmanagerConfigService{
		mam:     mam,
		secrets: secrets,
		store:   store,
		log:     log,
	}
}

func (s *AlertmanagerConfigService) GetAlertmanagerConfiguration(ctx context.Context, org int64) (definitions.GettableUserConfig, error) {
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: org}
	err := s.store.GetLatestAlertmanagerConfiguration(ctx, &query)
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to get latest configuration: %w", err)
	}
	cfg, err := Load([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to unmarshal alertmanager configuration: %w", err)
	}

	result := definitions.GettableUserConfig{
		TemplateFiles: cfg.TemplateFiles,
		AlertmanagerConfig: definitions.GettableApiAlertingConfig{
			Config: cfg.AlertmanagerConfig.Config,
		},
	}

	for _, recv := range cfg.AlertmanagerConfig.Receivers {
		receivers := make([]*definitions.GettableGrafanaReceiver, 0, len(recv.PostableGrafanaReceivers.GrafanaManagedReceivers))
		for _, pr := range recv.PostableGrafanaReceivers.GrafanaManagedReceivers {
			secureFields := make(map[string]bool, len(pr.SecureSettings))
			for k := range pr.SecureSettings {
				decryptedValue, err := s.getDecryptedSecret(pr, k)
				if err != nil {
					return definitions.GettableUserConfig{}, fmt.Errorf("failed to decrypt stored secure setting: %w", err)
				}
				if decryptedValue == "" {
					continue
				}
				secureFields[k] = true
			}
			gr := definitions.GettableGrafanaReceiver{
				UID:                   pr.UID,
				Name:                  pr.Name,
				Type:                  pr.Type,
				DisableResolveMessage: pr.DisableResolveMessage,
				Settings:              pr.Settings,
				SecureFields:          secureFields,
			}
			receivers = append(receivers, &gr)
		}
		gettableApiReceiver := definitions.GettableApiReceiver{
			GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
				GrafanaManagedReceivers: receivers,
			},
		}
		gettableApiReceiver.Name = recv.Name
		result.AlertmanagerConfig.Receivers = append(result.AlertmanagerConfig.Receivers, &gettableApiReceiver)
	}

	return result, nil
}

func (s *AlertmanagerConfigService) ApplyAlertmanagerConfiguration(ctx context.Context, org int64, config definitions.PostableUserConfig) error {
	// Get the last known working configuration
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: org}
	if err := s.store.GetLatestAlertmanagerConfiguration(ctx, &query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration %w", err)
		}
	}

	if err := s.LoadSecureSettings(ctx, org, config.AlertmanagerConfig.Receivers); err != nil {
		return err
	}

	if err := config.ProcessConfig(s.secrets.Encrypt); err != nil {
		return fmt.Errorf("failed to post process Alertmanager configuration: %w", err)
	}

	am, err := s.AlertmanagerFor(org)
	if err != nil {
		// It's okay if the alertmanager isn't ready yet, we're changing its config anyway.
		if !errors.Is(err, ErrAlertmanagerNotReady) {
			return err
		}
	}

	if err := am.SaveAndApplyConfig(ctx, &config); err != nil {
		s.log.Error("unable to save and apply alertmanager configuration", "err", err)
		return AlertmanagerConfigRejectedError{err}
	}

	return nil
}

func (s *AlertmanagerConfigService) AlertmanagerFor(orgID int64) (*Alertmanager, error) {
	return s.mam.AlertmanagerFor(orgID)
}

func (s *AlertmanagerConfigService) LoadSecureSettings(ctx context.Context, orgId int64, receivers []*definitions.PostableApiReceiver) error {
	// Get the last known working configuration
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: orgId}
	if err := s.store.GetLatestAlertmanagerConfiguration(ctx, &query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration: %w", err)
		}
	}

	currentReceiverMap := make(map[string]*definitions.PostableGrafanaReceiver)
	if query.Result != nil {
		currentConfig, err := Load([]byte(query.Result.AlertmanagerConfiguration))
		if err != nil {
			return fmt.Errorf("failed to load latest configuration: %w", err)
		}
		currentReceiverMap = currentConfig.GetGrafanaReceiverMap()
	}

	// Copy the previously known secure settings
	for i, r := range receivers {
		for j, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if gr.UID == "" { // new receiver
				continue
			}

			cgmr, ok := currentReceiverMap[gr.UID]
			if !ok {
				// it tries to update a receiver that didn't previously exist
				return UnknownReceiverError{UID: gr.UID}
			}

			// frontend sends only the secure settings that have to be updated
			// therefore we have to copy from the last configuration only those secure settings not included in the request
			for key := range cgmr.SecureSettings {
				_, ok := gr.SecureSettings[key]
				if !ok {
					decryptedValue, err := s.getDecryptedSecret(cgmr, key)
					if err != nil {
						return fmt.Errorf("failed to decrypt stored secure setting: %s: %w", key, err)
					}

					if receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings == nil {
						receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings = make(map[string]string, len(cgmr.SecureSettings))
					}

					receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key] = decryptedValue
				}
			}
		}
	}
	return nil
}

func (s *AlertmanagerConfigService) getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error) {
	storedValue, ok := r.SecureSettings[key]
	if !ok {
		return "", nil
	}

	decodeValue, err := base64.StdEncoding.DecodeString(storedValue)
	if err != nil {
		return "", err
	}

	decryptedValue, err := s.secrets.Decrypt(context.Background(), decodeValue)
	if err != nil {
		return "", err
	}

	return string(decryptedValue), nil
}

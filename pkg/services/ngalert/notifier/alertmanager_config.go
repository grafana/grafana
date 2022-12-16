package notifier

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
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

type configurationStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
}

func (moa *MultiOrgAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64) (definitions.GettableUserConfig, error) {
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: org}
	err := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, &query)
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to get latest configuration: %w", err)
	}

	result, err := moa.gettableUserConfigFromAMConfigString(ctx, org, query.Result.AlertmanagerConfiguration)
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}

	return result, nil
}

func (moa *MultiOrgAlertmanager) GetSuccessfullyAppliedAlertmanagerConfigurations(ctx context.Context, org int64, limit int) (definitions.GettableUserConfigs, error) {
	if limit < 1 || limit > store.ConfigRecordsLimit {
		limit = store.ConfigRecordsLimit
	}

	query := models.GetSuccessfullyAppliedAlertmanagerConfigurationsQuery{OrgID: org, Limit: limit}
	err := moa.configStore.GetSuccessfullyAppliedAlertmanagerConfigurations(ctx, &query)
	if err != nil {
		return definitions.GettableUserConfigs{}, fmt.Errorf("failed to get successfully applied configurations: %w", err)
	}

	configs := make(definitions.GettableUserConfigs, 0, len(query.Result))
	for _, config := range query.Result {
		gettableUserConfig, err := moa.gettableUserConfigFromAMConfigString(ctx, org, config.AlertmanagerConfiguration)
		if err != nil {
			return definitions.GettableUserConfigs{}, err
		}

		configs = append(configs, gettableUserConfig)
	}

	return configs, nil
}

func (moa *MultiOrgAlertmanager) ApplyAlertmanagerConfiguration(ctx context.Context, org int64, config definitions.PostableUserConfig) error {
	// Get the last known working configuration
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: org}
	if err := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, &query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration %w", err)
		}
	}

	if err := moa.Crypto.LoadSecureSettings(ctx, org, config.AlertmanagerConfig.Receivers); err != nil {
		return err
	}

	if err := config.ProcessConfig(moa.Crypto.Encrypt); err != nil {
		return fmt.Errorf("failed to post process Alertmanager configuration: %w", err)
	}

	am, err := moa.AlertmanagerFor(org)
	if err != nil {
		// It's okay if the alertmanager isn't ready yet, we're changing its config anyway.
		if !errors.Is(err, ErrAlertmanagerNotReady) {
			return err
		}
	}

	if err := am.SaveAndApplyConfig(ctx, &config); err != nil {
		moa.logger.Error("unable to save and apply alertmanager configuration", "error", err)
		return AlertmanagerConfigRejectedError{err}
	}

	return nil
}

func (moa *MultiOrgAlertmanager) mergeProvenance(ctx context.Context, config definitions.GettableUserConfig, org int64) (definitions.GettableUserConfig, error) {
	if config.AlertmanagerConfig.Route != nil {
		provenance, err := moa.ProvStore.GetProvenance(ctx, config.AlertmanagerConfig.Route, org)
		if err != nil {
			return definitions.GettableUserConfig{}, err
		}
		config.AlertmanagerConfig.Route.Provenance = provenance
	}

	cp := definitions.EmbeddedContactPoint{}
	cpProvs, err := moa.ProvStore.GetProvenances(ctx, org, cp.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}
	for _, receiver := range config.AlertmanagerConfig.Receivers {
		for _, contactPoint := range receiver.GrafanaManagedReceivers {
			if provenance, exists := cpProvs[contactPoint.UID]; exists {
				contactPoint.Provenance = provenance
			}
		}
	}

	tmpl := definitions.MessageTemplate{}
	tmplProvs, err := moa.ProvStore.GetProvenances(ctx, org, tmpl.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, nil
	}
	config.TemplateFileProvenances = tmplProvs

	mt := definitions.MuteTimeInterval{}
	mtProvs, err := moa.ProvStore.GetProvenances(ctx, org, mt.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, nil
	}
	config.AlertmanagerConfig.MuteTimeProvenances = mtProvs

	return config, nil
}

func (moa *MultiOrgAlertmanager) gettableUserConfigFromAMConfigString(ctx context.Context, orgID int64, config string) (definitions.GettableUserConfig, error) {
	cfg, err := Load([]byte(config))
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to unmarshal alertmanager configuration: %w", err)
	}

	gettableConfig := definitions.GettableUserConfig{
		TemplateFiles: cfg.TemplateFiles,
		AlertmanagerConfig: definitions.GettableApiAlertingConfig{
			Config: cfg.AlertmanagerConfig.Config,
		},
	}

	for _, recv := range cfg.AlertmanagerConfig.Receivers {
		receivers := make([]*definitions.GettableGrafanaReceiver, 0, len(recv.PostableGrafanaReceivers.GrafanaManagedReceivers))
		for _, postableReceiver := range recv.PostableGrafanaReceivers.GrafanaManagedReceivers {
			gettableReceiver, err := moa.gettableReceiverFromPostableReceiver(postableReceiver)
			if err != nil {
				return definitions.GettableUserConfig{}, err
			}

			receivers = append(receivers, gettableReceiver)
		}
		gettableApiReceiver := definitions.GettableApiReceiver{
			GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
				GrafanaManagedReceivers: receivers,
			},
		}
		gettableApiReceiver.Name = recv.Name
		gettableConfig.AlertmanagerConfig.Receivers = append(gettableConfig.AlertmanagerConfig.Receivers, &gettableApiReceiver)
	}

	gettableConfig, err = moa.mergeProvenance(ctx, gettableConfig, orgID)
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}

	return gettableConfig, nil
}

func (moa *MultiOrgAlertmanager) gettableReceiverFromPostableReceiver(pr *definitions.PostableGrafanaReceiver) (*definitions.GettableGrafanaReceiver, error) {
	secureFields := make(map[string]bool, len(pr.SecureSettings))
	for k := range pr.SecureSettings {
		decryptedValue, err := moa.Crypto.getDecryptedSecret(pr, k)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt stored secure setting: %w", err)
		}
		if decryptedValue == "" {
			continue
		}
		secureFields[k] = true
	}
	return &definitions.GettableGrafanaReceiver{
		UID:                   pr.UID,
		Name:                  pr.Name,
		Type:                  pr.Type,
		DisableResolveMessage: pr.DisableResolveMessage,
		Settings:              pr.Settings,
		SecureFields:          secureFields,
	}, nil
}

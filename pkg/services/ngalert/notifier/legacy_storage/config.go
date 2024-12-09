package legacy_storage

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type amConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

func DeserializeAlertmanagerConfig(config []byte) (*definitions.PostableUserConfig, error) {
	result := definitions.PostableUserConfig{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, makeErrBadAlertmanagerConfiguration(err)
	}
	return &result, nil
}

func SerializeAlertmanagerConfig(config definitions.PostableUserConfig) ([]byte, error) {
	return json.Marshal(config)
}

type ConfigRevision struct {
	Config           *definitions.PostableUserConfig
	ConcurrencyToken string
	Version          string
}

func getLastConfiguration(ctx context.Context, orgID int64, store amConfigStore) (*ConfigRevision, error) {
	alertManagerConfig, err := store.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if alertManagerConfig == nil {
		return nil, ErrNoAlertmanagerConfiguration.Errorf("")
	}

	concurrencyToken := alertManagerConfig.ConfigurationHash
	cfg, err := DeserializeAlertmanagerConfig([]byte(alertManagerConfig.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	return &ConfigRevision{
		Config:           cfg,
		ConcurrencyToken: concurrencyToken,
		Version:          alertManagerConfig.ConfigurationVersion,
	}, nil
}

type alertmanagerConfigStoreImpl struct {
	store amConfigStore
}

func NewAlertmanagerConfigStore(store amConfigStore) *alertmanagerConfigStoreImpl {
	return &alertmanagerConfigStoreImpl{store: store}
}

func (a alertmanagerConfigStoreImpl) Get(ctx context.Context, orgID int64) (*ConfigRevision, error) {
	return getLastConfiguration(ctx, orgID, a.store)
}

func (a alertmanagerConfigStoreImpl) Save(ctx context.Context, revision *ConfigRevision, orgID int64) error {
	serialized, err := SerializeAlertmanagerConfig(*revision.Config)
	if err != nil {
		return err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.Version,
		FetchedConfigurationHash:  revision.ConcurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	return a.PersistConfig(ctx, &cmd)
}

// PersistConfig validates to config before eventually persisting it if no error occurs
func (a alertmanagerConfigStoreImpl) PersistConfig(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	cfg := &definitions.PostableUserConfig{}
	if err := json.Unmarshal([]byte(cmd.AlertmanagerConfiguration), cfg); err != nil {
		return fmt.Errorf("change would result in an invalid configuration state: %w", err)
	}
	return a.store.UpdateAlertmanagerConfiguration(ctx, cmd)
}

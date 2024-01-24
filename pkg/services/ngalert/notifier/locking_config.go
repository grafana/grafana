package notifier

import (
	"context"
	"encoding/json"
	"fmt"

	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

var (
	ErrBadAlertmanagerConfiguration = fmt.Errorf("bad Alertmanager configuration")
)

type AlertmanagerLockedConfig struct {
	Config        *api.PostableUserConfig
	ConfigHash    string
	ConfigVersion string
}

type LockingConfigStore struct {
	Store configStore
}

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

func NewLockingConfigStore(store configStore) *LockingConfigStore {
	return &LockingConfigStore{Store: store}
}

func (v *LockingConfigStore) GetLockingConfig(ctx context.Context, orgID int64) (*AlertmanagerLockedConfig, error) {
	baseCfg, err := v.Store.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if baseCfg == nil {
		return nil, store.ErrNoAlertmanagerConfiguration
	}

	cfg, err := deserializeConfig([]byte(baseCfg.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}
	return &AlertmanagerLockedConfig{
		Config:        cfg,
		ConfigHash:    baseCfg.ConfigurationHash,
		ConfigVersion: baseCfg.ConfigurationVersion,
	}, nil
}

func (v *LockingConfigStore) SaveLockingConfig(ctx context.Context, orgID int64, revision *AlertmanagerLockedConfig) error {
	newCfg, err := json.Marshal(&revision.Config)
	if err != nil {
		return err
	}
	_, err = deserializeConfig(newCfg)
	if err != nil {
		return fmt.Errorf("change would result in an invalid configuration state: %w", err)
	}
	return v.Store.UpdateAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
		OrgID:                     orgID,
		AlertmanagerConfiguration: string(newCfg),
		FetchedConfigurationHash:  revision.ConfigHash,
		ConfigurationVersion:      revision.ConfigVersion,
		Default:                   false,
	})
}

func deserializeConfig(config []byte) (*api.PostableUserConfig, error) {
	result := api.PostableUserConfig{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadAlertmanagerConfiguration, err)
	}
	return &result, nil
}

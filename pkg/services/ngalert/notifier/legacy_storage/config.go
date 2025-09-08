package legacy_storage

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type crypto interface {
	EncryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error
	DecryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error
}

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
	readConfig       *definitions.PostableApiAlertingConfig
	includeStaged    bool
}

// IncludeStaged will include staged resources in the Get methods of the receiver.
func (rev *ConfigRevision) IncludeStaged() error {
	rev.includeStaged = len(rev.Config.ExtraConfigs) > 0
	if rev.includeStaged {
		return rev.loadStaged()
	}
	return nil
}

func (rev *ConfigRevision) loadStaged() error {
	if len(rev.Config.ExtraConfigs) == 0 {
		return nil
	}
	m, err := rev.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return err
	}
	log.New("ngalert.notify.legacy_storage").Debug("Got configuration with staged resources", append(m.LogContext(), "version", rev.Version)...)
	rev.readConfig = &m.Config
	return nil
}

func (rev *ConfigRevision) getConfigForRead() *definitions.PostableApiAlertingConfig {
	if !rev.includeStaged {
		return &rev.Config.AlertmanagerConfig
	}
	if rev.readConfig != nil {
		return rev.readConfig
	}
	err := rev.loadStaged()
	if err != nil {
		log.New("ngalert.notify.legacy_storage").Warn("Failed to get merged configuration.", "error", err, "version", rev.Version)
		return &rev.Config.AlertmanagerConfig
	}
	return rev.readConfig
}

func (rev *ConfigRevision) reset() {
	rev.readConfig = nil
}

type alertmanagerConfigStoreImpl struct {
	store  amConfigStore
	crypto crypto
}

func NewAlertmanagerConfigStore(store amConfigStore, crypto crypto) *alertmanagerConfigStoreImpl {
	return &alertmanagerConfigStoreImpl{store: store, crypto: crypto}
}

func (a alertmanagerConfigStoreImpl) Get(ctx context.Context, orgID int64) (*ConfigRevision, error) {
	alertManagerConfig, err := a.store.GetLatestAlertmanagerConfiguration(ctx, orgID)
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

	err = a.crypto.DecryptExtraConfigs(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt extra configurations: %w", err)
	}

	return &ConfigRevision{
		Config:           cfg,
		ConcurrencyToken: concurrencyToken,
		Version:          alertManagerConfig.ConfigurationVersion,
	}, nil
}

func (a alertmanagerConfigStoreImpl) Save(ctx context.Context, revision *ConfigRevision, orgID int64) error {
	err := a.crypto.EncryptExtraConfigs(ctx, revision.Config)
	if err != nil {
		return fmt.Errorf("failed to encrypt extra configurations: %w", err)
	}

	serialized, err := SerializeAlertmanagerConfig(*revision.Config)
	if err != nil {
		return err
	}
	return a.store.UpdateAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.Version,
		FetchedConfigurationHash:  revision.ConcurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	})
}

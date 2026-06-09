package legacy_storage

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

type crypto interface {
	EncryptExtraConfigs(ctx context.Context, config *v1.AMConfigV1) error
	DecryptExtraConfigs(ctx context.Context, config *v1.AMConfigV1) error
}

type amConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

func DeserializeAlertmanagerConfig(config []byte) (*v1.AMConfigDB, error) {
	result := v1.AMConfigDB{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, makeErrBadAlertmanagerConfiguration(err)
	}
	return &result, nil
}

func SerializeAlertmanagerConfig(config v1.AMConfigV1) ([]byte, error) {
	return json.Marshal(v1.ToDBModel(&config))
}

type ConfigRevision struct {
	Config           *v1.AMConfigV1
	ConcurrencyToken string
	Version          string
}
type alertmanagerConfigStoreImpl struct {
	store    amConfigStore
	crypto   crypto
	features featuremgmt.FeatureToggles
}

func NewAlertmanagerConfigStore(store amConfigStore, crypto crypto, features featuremgmt.FeatureToggles) *alertmanagerConfigStoreImpl {
	return &alertmanagerConfigStoreImpl{store: store, crypto: crypto, features: features}
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
	dbCfg, err := DeserializeAlertmanagerConfig([]byte(alertManagerConfig.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}
	cfg := v1.ToModel(dbCfg)

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

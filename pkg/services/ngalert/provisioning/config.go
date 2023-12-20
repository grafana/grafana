package provisioning

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func deserializeAlertmanagerConfig(config []byte) (*definitions.PostableUserConfig, error) {
	result := definitions.PostableUserConfig{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, makeErrBadAlertmanagerConfiguration(err)
	}
	return &result, nil
}

func serializeAlertmanagerConfig(config definitions.PostableUserConfig) ([]byte, error) {
	return json.Marshal(config)
}

type cfgRevision struct {
	cfg              *definitions.PostableUserConfig
	concurrencyToken string
	version          string
}

func getLastConfiguration(ctx context.Context, orgID int64, store AMConfigStore) (*cfgRevision, error) {
	alertManagerConfig, err := store.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if alertManagerConfig == nil {
		return nil, ErrNoAlertmanagerConfiguration.Errorf("")
	}

	concurrencyToken := alertManagerConfig.ConfigurationHash
	cfg, err := deserializeAlertmanagerConfig([]byte(alertManagerConfig.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	return &cfgRevision{
		cfg:              cfg,
		concurrencyToken: concurrencyToken,
		version:          alertManagerConfig.ConfigurationVersion,
	}, nil
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*cfgRevision, error)
	Save(ctx context.Context, revision *cfgRevision, orgID int64, afterSave func(ctx context.Context) error) error
}

type alertmanagerConfigStoreImpl struct {
	store AMConfigStore
	xact  TransactionManager
}

func (a alertmanagerConfigStoreImpl) Get(ctx context.Context, orgID int64) (*cfgRevision, error) {
	return getLastConfiguration(ctx, orgID, a.store)
}

func (a alertmanagerConfigStoreImpl) Save(ctx context.Context, revision *cfgRevision, orgID int64, afterSave func(ctx context.Context) error) error {
	serialized, err := serializeAlertmanagerConfig(*revision.cfg)
	if err != nil {
		return err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.version,
		FetchedConfigurationHash:  revision.concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	return a.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = PersistConfig(ctx, a.store, &cmd)
		if err != nil {
			return err
		}
		err = afterSave(ctx)
		if err != nil {
			return err
		}
		return nil
	})
}

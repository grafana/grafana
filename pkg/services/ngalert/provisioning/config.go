package provisioning

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func deserializeAlertmanagerConfig(config []byte) (*definitions.PostableUserConfig, error) {
	result := definitions.PostableUserConfig{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, fmt.Errorf("failed to deserialize alertmanager configuration: %w", err)
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
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	if err := store.GetLatestAlertmanagerConfiguration(ctx, &q); err != nil {
		return nil, err
	}

	if q.Result == nil {
		return nil, fmt.Errorf("no alertmanager configuration present in this org")
	}

	concurrencyToken := q.Result.ConfigurationHash
	cfg, err := deserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	return &cfgRevision{
		cfg:              cfg,
		concurrencyToken: concurrencyToken,
		version:          q.Result.ConfigurationVersion,
	}, nil
}

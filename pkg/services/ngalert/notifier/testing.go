package notifier

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	alertingImages "github.com/grafana/alerting/images"
)

type fakeConfigStore struct {
	configs map[int64]*models.AlertConfiguration

	// historicConfigs stores configs by orgID.
	historicConfigs map[int64][]*models.HistoricAlertConfiguration

	// notificationSettings stores notification settings by orgID.
	notificationSettings map[int64]map[models.AlertRuleKey][]models.NotificationSettings
}

func (f *fakeConfigStore) ListNotificationSettings(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error) {
	settings, ok := f.notificationSettings[q.OrgID]
	if !ok {
		return nil, nil
	}
	if q.ReceiverName != "" {
		filteredSettings := make(map[models.AlertRuleKey][]models.NotificationSettings)
		for key, notificationSettings := range settings {
			// Current semantics is that we only key entries where any of the settings match the receiver name.
			var found bool
			for _, setting := range notificationSettings {
				if q.ReceiverName == setting.Receiver {
					found = true
					break
				}
			}
			if found {
				filteredSettings[key] = notificationSettings
			}
		}
		return filteredSettings, nil
	}

	return settings, nil
}

// Saves the image or returns an error.
func (f *fakeConfigStore) SaveImage(ctx context.Context, img *models.Image) error {
	return alertingImages.ErrImageNotFound
}

func (f *fakeConfigStore) GetImage(ctx context.Context, token string) (*models.Image, error) {
	return nil, alertingImages.ErrImageNotFound
}

func (f *fakeConfigStore) GetImageByURL(ctx context.Context, url string) (*models.Image, error) {
	return nil, alertingImages.ErrImageNotFound
}

func (f *fakeConfigStore) URLExists(ctx context.Context, url string) (bool, error) {
	return false, alertingImages.ErrImageNotFound
}

func (f *fakeConfigStore) GetImages(ctx context.Context, tokens []string) ([]models.Image, []string, error) {
	return nil, nil, alertingImages.ErrImageNotFound
}

func NewFakeConfigStore(t *testing.T, configs map[int64]*models.AlertConfiguration) *fakeConfigStore {
	t.Helper()

	historicConfigs := make(map[int64][]*models.HistoricAlertConfiguration)
	for org, config := range configs {
		historicConfig := models.HistoricConfigFromAlertConfig(*config)
		historicConfigs[org] = append(historicConfigs[org], &historicConfig)
	}

	return &fakeConfigStore{
		configs:         configs,
		historicConfigs: historicConfigs,
	}
}

func (f *fakeConfigStore) GetAllLatestAlertmanagerConfiguration(context.Context) ([]*models.AlertConfiguration, error) {
	result := make([]*models.AlertConfiguration, 0, len(f.configs))
	for _, configuration := range f.configs {
		result = append(result, configuration)
	}
	return result, nil
}

func (f *fakeConfigStore) GetLatestAlertmanagerConfiguration(_ context.Context, orgID int64) (*models.AlertConfiguration, error) {
	config, ok := f.configs[orgID]
	if !ok {
		return nil, store.ErrNoAlertmanagerConfiguration
	}
	return config, nil
}

func (f *fakeConfigStore) SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) (*models.AlertConfiguration, error) {
	return f.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error { return nil })
}

func (f *fakeConfigStore) SaveAlertmanagerConfigurationWithCallback(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) (*models.AlertConfiguration, error) {
	cfg := models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}
	f.configs[cmd.OrgID] = &cfg

	historicConfig := models.HistoricConfigFromAlertConfig(cfg)
	if cmd.LastApplied != 0 {
		historicConfig.LastApplied = time.Now().UTC().Unix()
		f.historicConfigs[cmd.OrgID] = append(f.historicConfigs[cmd.OrgID], &historicConfig)
	}

	if err := callback(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (f *fakeConfigStore) UpdateAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	if config, exists := f.configs[cmd.OrgID]; exists && config.ConfigurationHash == cmd.FetchedConfigurationHash {
		newConfig := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			OrgID:                     cmd.OrgID,
			ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
			ConfigurationVersion:      "v1",
			Default:                   cmd.Default,
		}
		f.configs[cmd.OrgID] = &newConfig

		historicConfig := models.HistoricConfigFromAlertConfig(newConfig)
		f.historicConfigs[cmd.OrgID] = append(f.historicConfigs[cmd.OrgID], &historicConfig)
		return nil
	}

	return errors.New("config not found or hash not valid")
}

func (f *fakeConfigStore) MarkConfigurationAsApplied(_ context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error {
	orgConfigs, ok := f.historicConfigs[cmd.OrgID]
	if !ok {
		return nil
	}

	// Iterate backwards to find the latest config first.
	for i := len(orgConfigs) - 1; i >= 0; i-- {
		for _, config := range orgConfigs {
			if config.ConfigurationHash == cmd.ConfigurationHash {
				config.LastApplied = time.Now().UTC().Unix()
				return nil
			}
		}
	}

	return nil
}

func (f *fakeConfigStore) GetAppliedConfigurations(_ context.Context, orgID int64, limit int) ([]*models.HistoricAlertConfiguration, error) {
	configsByOrg, ok := f.historicConfigs[orgID]
	if !ok {
		return []*models.HistoricAlertConfiguration{}, nil
	}

	// Iterate backwards to get the latest applied configs.
	var configs []*models.HistoricAlertConfiguration
	start := len(configsByOrg) - 1
	end := start - limit
	if end < 0 {
		end = 0
	}

	for i := start; i >= end; i-- {
		if configsByOrg[i].LastApplied > 0 {
			configs = append(configs, configsByOrg[i])
		}
	}

	return configs, nil
}

func (f *fakeConfigStore) GetHistoricalConfiguration(_ context.Context, orgID int64, id int64) (*models.HistoricAlertConfiguration, error) {
	configsByOrg, ok := f.historicConfigs[orgID]
	if !ok {
		return &models.HistoricAlertConfiguration{}, store.ErrNoAlertmanagerConfiguration
	}

	for _, conf := range configsByOrg {
		if conf.ID == id && conf.OrgID == orgID {
			return conf, nil
		}
	}

	return &models.HistoricAlertConfiguration{}, store.ErrNoAlertmanagerConfiguration
}

type FakeOrgStore struct {
	orgs []int64
}

func NewFakeOrgStore(t *testing.T, orgs []int64) *FakeOrgStore {
	t.Helper()

	return &FakeOrgStore{
		orgs: orgs,
	}
}

func (f *FakeOrgStore) GetOrgs(_ context.Context) ([]int64, error) {
	return f.orgs, nil
}

type fakeState struct {
	data string
}

func (fs *fakeState) MarshalBinary() ([]byte, error) {
	return []byte(fs.data), nil
}

type NoValidation struct {
}

func (n NoValidation) Validate(_ models.NotificationSettings) error {
	return nil
}

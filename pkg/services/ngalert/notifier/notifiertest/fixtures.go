package notifiertest

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	alertingCluster "github.com/grafana/alerting/cluster"
	alertingImages "github.com/grafana/alerting/images"
	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/secrets/manager/managertest"
	"github.com/grafana/grafana/pkg/setting"
)

type FakeConfigStore struct {
	Configs map[int64]*models.AlertConfiguration

	// HistoricConfigs stores configs by orgID.
	HistoricConfigs map[int64][]*models.HistoricAlertConfiguration

	// NotificationSettings stores notification settings by orgID.
	NotificationSettings map[int64]map[models.AlertRuleKey]models.ContactPointRouting
}

func (f *FakeConfigStore) ListContactPointRoutings(ctx context.Context, q models.ListContactPointRoutingsQuery) (map[models.AlertRuleKey]models.ContactPointRouting, error) {
	settings, ok := f.NotificationSettings[q.OrgID]
	if !ok {
		return nil, nil
	}
	if q.ReceiverName != "" {
		filteredSettings := make(map[models.AlertRuleKey]models.ContactPointRouting)
		for key, NotificationSettings := range settings {
			if q.ReceiverName == NotificationSettings.Receiver {
				filteredSettings[key] = NotificationSettings
			}
		}
		return filteredSettings, nil
	}

	return settings, nil
}

// Saves the image or returns an error.
func (f *FakeConfigStore) SaveImage(ctx context.Context, img *models.Image) error {
	return alertingImages.ErrImageNotFound
}

func (f *FakeConfigStore) GetImage(ctx context.Context, token string) (*models.Image, error) {
	return nil, alertingImages.ErrImageNotFound
}

func (f *FakeConfigStore) GetImageByURL(ctx context.Context, url string) (*models.Image, error) {
	return nil, alertingImages.ErrImageNotFound
}

func (f *FakeConfigStore) URLExists(ctx context.Context, url string) (bool, error) {
	return false, alertingImages.ErrImageNotFound
}

func (f *FakeConfigStore) GetImages(ctx context.Context, tokens []string) ([]models.Image, []string, error) {
	return nil, nil, alertingImages.ErrImageNotFound
}

func NewFakeConfigStore(t *testing.T, configs map[int64]*models.AlertConfiguration) *FakeConfigStore {
	t.Helper()

	HistoricConfigs := make(map[int64][]*models.HistoricAlertConfiguration)
	for org, config := range configs {
		historicConfig := models.HistoricConfigFromAlertConfig(*config)
		HistoricConfigs[org] = append(HistoricConfigs[org], &historicConfig)
	}

	return &FakeConfigStore{
		Configs:         configs,
		HistoricConfigs: HistoricConfigs,
	}
}

func NewFakeNotificationStore(t *testing.T, notificationSettings map[int64]map[models.AlertRuleKey]models.ContactPointRouting) *FakeConfigStore {
	t.Helper()
	return &FakeConfigStore{
		NotificationSettings: notificationSettings,
	}
}

func (f *FakeConfigStore) GetAllLatestAlertmanagerConfiguration(context.Context) ([]*models.AlertConfiguration, error) {
	result := make([]*models.AlertConfiguration, 0, len(f.Configs))
	for _, configuration := range f.Configs {
		result = append(result, configuration)
	}
	return result, nil
}

func (f *FakeConfigStore) GetLatestAlertmanagerConfiguration(_ context.Context, orgID int64) (*models.AlertConfiguration, error) {
	config, ok := f.Configs[orgID]
	if !ok {
		return nil, store.ErrNoAlertmanagerConfiguration
	}
	return config, nil
}

func (f *FakeConfigStore) SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return f.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func(models.AlertConfiguration) error { return nil })
}

func (f *FakeConfigStore) SaveAlertmanagerConfigurationWithCallback(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) error {
	cfg := models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}
	f.Configs[cmd.OrgID] = &cfg

	historicConfig := models.HistoricConfigFromAlertConfig(cfg)
	if cmd.LastApplied != 0 {
		historicConfig.LastApplied = time.Now().UTC().Unix()
		f.HistoricConfigs[cmd.OrgID] = append(f.HistoricConfigs[cmd.OrgID], &historicConfig)
	}

	if err := callback(cfg); err != nil {
		return err
	}

	return nil
}

func (f *FakeConfigStore) UpdateAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	if config, exists := f.Configs[cmd.OrgID]; exists && config.ConfigurationHash == cmd.FetchedConfigurationHash {
		newConfig := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			OrgID:                     cmd.OrgID,
			ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
			ConfigurationVersion:      "v1",
			Default:                   cmd.Default,
		}
		f.Configs[cmd.OrgID] = &newConfig

		historicConfig := models.HistoricConfigFromAlertConfig(newConfig)
		f.HistoricConfigs[cmd.OrgID] = append(f.HistoricConfigs[cmd.OrgID], &historicConfig)
		return nil
	}

	return errors.New("config not found or hash not valid")
}

func (f *FakeConfigStore) MarkConfigurationAsApplied(_ context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error {
	orgConfigs, ok := f.HistoricConfigs[cmd.OrgID]
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

func (f *FakeConfigStore) GetAppliedConfigurations(_ context.Context, orgID int64, limit int) ([]*models.HistoricAlertConfiguration, error) {
	configsByOrg, ok := f.HistoricConfigs[orgID]
	if !ok {
		return []*models.HistoricAlertConfiguration{}, nil
	}

	// Iterate backwards to get the latest applied configs.
	var configs []*models.HistoricAlertConfiguration
	start := len(configsByOrg) - 1
	end := max(start-limit, 0)

	for i := start; i >= end; i-- {
		if configsByOrg[i].LastApplied > 0 {
			configs = append(configs, configsByOrg[i])
		}
	}

	return configs, nil
}

func (f *FakeConfigStore) GetHistoricalConfiguration(_ context.Context, orgID int64, id int64) (*models.HistoricAlertConfiguration, error) {
	configsByOrg, ok := f.HistoricConfigs[orgID]
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
	Orgs []int64
}

func NewFakeOrgStore(t *testing.T, orgs []int64) *FakeOrgStore {
	t.Helper()

	return &FakeOrgStore{
		Orgs: orgs,
	}
}

func (f *FakeOrgStore) FetchOrgIds(_ context.Context) ([]int64, error) {
	return f.Orgs, nil
}

type NoValidation struct{}

func (n NoValidation) Config() *v1.AMConfigV1 {
	return nil
}

func (n NoValidation) Validate(_ models.NotificationSettings) error {
	return nil
}

// MockBroadcastChannel captures broadcast messages for testing.
type MockBroadcastChannel struct {
	broadcasts [][]byte
}

// ReliableDelivery implements alertingCluster.ClusterChannel.
func (m *MockBroadcastChannel) ReliableDelivery([]byte) bool { return true }

// Broadcast implements alertingCluster.ClusterChannel.
func (m *MockBroadcastChannel) Broadcast(b []byte) {
	m.broadcasts = append(m.broadcasts, b)
}

// Broadcasts returns all captured broadcast messages.
func (m *MockBroadcastChannel) Broadcasts() [][]byte {
	return m.broadcasts
}

// MockClusterPeer implements alertingNotify.ClusterPeer for testing.
type MockClusterPeer struct {
	Channel     *MockBroadcastChannel
	LastOptions []alertingCluster.ChannelOption
}

// Position implements alertingNotify.ClusterPeer.
func (m *MockClusterPeer) Position() int {
	return 0
}

// WaitReady implements alertingNotify.ClusterPeer.
func (m *MockClusterPeer) WaitReady(context.Context) error {
	return nil
}

// AddState implements alertingNotify.ClusterPeer.
func (m *MockClusterPeer) AddState(_ string, _ alertingCluster.State, _ prometheus.Registerer, opts ...alertingCluster.ChannelOption) alertingCluster.ClusterChannel {
	m.LastOptions = opts
	return m.Channel
}

type FakeEmailValidator struct {
	ValidateIntegrationFunc       func(ctx context.Context, orgID int64, integration models.Integration, decryptFn models.DecryptFn, logger log.Logger) error
	ValidateIntegrationConfigFunc func(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig, logger log.Logger) error
}

func NewFakeEmailValidator(t *testing.T, err error) *FakeEmailValidator {
	t.Helper()
	return &FakeEmailValidator{
		ValidateIntegrationFunc: func(ctx context.Context, orgID int64, integration models.Integration, decryptFn models.DecryptFn, logger log.Logger) error {
			return err
		},
		ValidateIntegrationConfigFunc: func(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig, logger log.Logger) error {
			return err
		},
	}
}

func (f *FakeEmailValidator) ValidateIntegration(ctx context.Context, orgID int64, integration models.Integration, decryptFn models.DecryptFn, logger log.Logger) error {
	if f.ValidateIntegrationFunc != nil {
		return f.ValidateIntegrationFunc(ctx, orgID, integration, decryptFn, logger)
	}
	return nil
}

func (f *FakeEmailValidator) ValidateIntegrationConfig(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig, logger log.Logger) error {
	if f.ValidateIntegrationConfigFunc != nil {
		return f.ValidateIntegrationConfigFunc(ctx, orgID, integration, logger)
	}
	return nil
}

type Environment struct {
	Settings       *setting.Cfg
	OrgStore       *FakeOrgStore
	KVStore        *fakes.FakeKVStore
	Metrics        *metrics.NGAlert
	SecretsService *secretsManager.SecretsService
}

func NewEnvironment(t *testing.T, orgs []int64, disabledOrgs map[int64]struct{}, secretService *secretsManager.SecretsService) Environment {
	t.Helper()
	if secretService == nil {
		secretService = managertest.SetupService(secretsManager.ProvideSecretsService, t, fake_secrets.NewFakeSecretsStore())
	}
	cfg := &setting.Cfg{
		DataPath: t.TempDir(),
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   disabledOrgs,
		},
	}
	return Environment{
		Settings:       cfg,
		OrgStore:       NewFakeOrgStore(t, orgs),
		KVStore:        fakes.NewFakeKVStore(t),
		Metrics:        metrics.NewNGAlert(prometheus.NewPedanticRegistry()),
		SecretsService: secretService,
	}
}

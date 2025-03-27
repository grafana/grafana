package notifier

import (
	"bytes"
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/common/model"

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

func (f *fakeConfigStore) SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return f.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error { return nil })
}

func (f *fakeConfigStore) SaveAlertmanagerConfigurationWithCallback(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) error {
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
		return err
	}

	return nil
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

func (f *FakeOrgStore) FetchOrgIds(_ context.Context) ([]int64, error) {
	return f.orgs, nil
}

type NoValidation struct {
}

func (n NoValidation) Validate(_ models.NotificationSettings) error {
	return nil
}

var errInvalidState = fmt.Errorf("invalid state")

// silenceState copied from state in prometheus-alertmanager/silence/silence.go.
type silenceState map[string]*silencepb.MeshSilence

// MarshalBinary copied from prometheus-alertmanager/silence/silence.go.
func (s silenceState) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer

	for _, e := range s {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

// decodeSilenceState copied from decodeState in prometheus-alertmanager/silence/silence.go.
func decodeSilenceState(r io.Reader) (silenceState, error) {
	st := silenceState{}
	for {
		var s silencepb.MeshSilence
		_, err := pbutil.ReadDelimited(r, &s)
		if err == nil {
			if s.Silence == nil {
				return nil, errInvalidState
			}
			st[s.Silence.Id] = &s
			continue
		}
		//nolint:errorlint
		if err == io.EOF {
			break
		}
		return nil, err
	}
	return st, nil
}

func createSilence(id string, startsAt, expiresAt time.Time) *silencepb.MeshSilence {
	return &silencepb.MeshSilence{
		Silence: &silencepb.Silence{
			Id: id,
			Matchers: []*silencepb.Matcher{
				{
					Type:    silencepb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: "test_alert",
				},
				{
					Type:    silencepb.Matcher_EQUAL,
					Name:    models.FolderTitleLabel,
					Pattern: "test_alert_folder",
				},
			},
			StartsAt:  startsAt,
			EndsAt:    expiresAt,
			CreatedBy: "Grafana Test",
			Comment:   "Test Silence",
		},
		ExpiresAt: expiresAt,
	}
}

// receiverKey copied from prometheus-alertmanager/nflog/nflog.go.
func receiverKey(r *nflogpb.Receiver) string {
	return fmt.Sprintf("%s/%s/%d", r.GroupName, r.Integration, r.Idx)
}

// stateKey copied from prometheus-alertmanager/nflog/nflog.go.
func stateKey(k string, r *nflogpb.Receiver) string {
	return fmt.Sprintf("%s:%s", k, receiverKey(r))
}

// nflogState copied from state in prometheus-alertmanager/nflog/nflog.go.
type nflogState map[string]*nflogpb.MeshEntry

// MarshalBinary copied from prometheus-alertmanager/nflog/nflog.go.
func (s nflogState) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer

	for _, e := range s {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

// decodeNflogState copied from decodeState in prometheus-alertmanager/nflog/nflog.go.
func decodeNflogState(r io.Reader) (nflogState, error) {
	st := nflogState{}
	for {
		var e nflogpb.MeshEntry
		_, err := pbutil.ReadDelimited(r, &e)
		if err == nil {
			if e.Entry == nil || e.Entry.Receiver == nil {
				return nil, errInvalidState
			}
			st[stateKey(string(e.Entry.GroupKey), e.Entry.Receiver)] = &e
			continue
		}
		if errors.Is(err, io.EOF) {
			break
		}
		return nil, err
	}
	return st, nil
}

func createNotificationLog(groupKey string, receiverName string, sentAt, expiresAt time.Time) (string, *nflogpb.MeshEntry) {
	recv := nflogpb.Receiver{GroupName: receiverName, Integration: "test3", Idx: 0}
	return stateKey(groupKey, &recv), &nflogpb.MeshEntry{
		Entry: &nflogpb.Entry{
			GroupKey:  []byte(groupKey),
			Receiver:  &recv,
			Resolved:  false,
			Timestamp: sentAt,
		},
		ExpiresAt: expiresAt,
	}
}

type call struct {
	Method string
	Args   []interface{}
}

type fakeAlertRuleNotificationStore struct {
	Calls []call

	RenameReceiverInNotificationSettingsFn func(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error)
	ListNotificationSettingsFn             func(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error)
}

func (f *fakeAlertRuleNotificationStore) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
	call := call{
		Method: "RenameReceiverInNotificationSettings",
		Args:   []interface{}{ctx, orgID, oldReceiver, newReceiver, validateProvenance, dryRun},
	}
	f.Calls = append(f.Calls, call)

	if f.RenameReceiverInNotificationSettingsFn != nil {
		return f.RenameReceiverInNotificationSettingsFn(ctx, orgID, oldReceiver, newReceiver, validateProvenance, dryRun)
	}

	// Default values when no function hook is provided
	return nil, nil, nil
}

func (f *fakeAlertRuleNotificationStore) ListNotificationSettings(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error) {
	call := call{
		Method: "ListNotificationSettings",
		Args:   []interface{}{ctx, q},
	}
	f.Calls = append(f.Calls, call)

	if f.ListNotificationSettingsFn != nil {
		return f.ListNotificationSettingsFn(ctx, q)
	}

	// Default values when no function hook is provided
	return nil, nil
}

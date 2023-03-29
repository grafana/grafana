package notifier

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type fakeConfigStore struct {
	configs map[int64]*models.AlertConfiguration

	// appliedConfigs stores configs by orgID and config hash.
	appliedConfigs map[int64]map[string]*models.AlertConfiguration
}

// Saves the image or returns an error.
func (f *fakeConfigStore) SaveImage(ctx context.Context, img *models.Image) error {
	return models.ErrImageNotFound
}

func (f *fakeConfigStore) GetImage(ctx context.Context, token string) (*models.Image, error) {
	return nil, models.ErrImageNotFound
}

func (f *fakeConfigStore) GetImages(ctx context.Context, tokens []string) ([]models.Image, []string, error) {
	return nil, nil, models.ErrImageNotFound
}

func NewFakeConfigStore(t *testing.T, configs map[int64]*models.AlertConfiguration) *fakeConfigStore {
	t.Helper()

	return &fakeConfigStore{
		configs:        configs,
		appliedConfigs: make(map[int64]map[string]*models.AlertConfiguration),
	}
}

func (f *fakeConfigStore) GetAllLatestAlertmanagerConfiguration(context.Context) ([]*models.AlertConfiguration, error) {
	result := make([]*models.AlertConfiguration, 0, len(f.configs))
	for _, configuration := range f.configs {
		result = append(result, configuration)
	}
	return result, nil
}

func (f *fakeConfigStore) GetLatestAlertmanagerConfiguration(_ context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) (*models.AlertConfiguration, error) {
	config, ok := f.configs[query.OrgID]
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

	if err := callback(); err != nil {
		return err
	}

	if cmd.LastApplied != 0 {
		if _, ok := f.appliedConfigs[cmd.OrgID]; !ok {
			f.appliedConfigs[cmd.OrgID] = make(map[string]*models.AlertConfiguration)
		}
		f.appliedConfigs[cmd.OrgID][cfg.ConfigurationHash] = &cfg
	}

	return nil
}

func (f *fakeConfigStore) UpdateAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	if config, exists := f.configs[cmd.OrgID]; exists && config.ConfigurationHash == cmd.FetchedConfigurationHash {
		f.configs[cmd.OrgID] = &models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			OrgID:                     cmd.OrgID,
			ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
			ConfigurationVersion:      "v1",
			Default:                   cmd.Default,
		}
		return nil
	}
	return errors.New("config not found or hash not valid")
}

func (f *fakeConfigStore) MarkConfigurationAsApplied(_ context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error {
	for _, config := range f.configs {
		if config.ConfigurationHash == cmd.ConfigurationHash && config.OrgID == cmd.OrgID {
			if _, ok := f.appliedConfigs[cmd.OrgID]; !ok {
				f.appliedConfigs[cmd.OrgID] = make(map[string]*models.AlertConfiguration)
			}
			f.appliedConfigs[cmd.OrgID][cmd.ConfigurationHash] = config
			return nil
		}
	}

	return errors.New("config not found")
}

type FakeOrgStore struct {
	orgs []int64
}

func NewFakeOrgStore(t *testing.T, orgs []int64) FakeOrgStore {
	t.Helper()

	return FakeOrgStore{
		orgs: orgs,
	}
}

func (f *FakeOrgStore) GetOrgs(_ context.Context) ([]int64, error) {
	return f.orgs, nil
}

type FakeKVStore struct {
	mtx   sync.Mutex
	store map[int64]map[string]map[string]string
}

func NewFakeKVStore(t *testing.T) *FakeKVStore {
	t.Helper()

	return &FakeKVStore{
		store: map[int64]map[string]map[string]string{},
	}
}

func (fkv *FakeKVStore) Get(_ context.Context, orgId int64, namespace string, key string) (string, bool, error) {
	fkv.mtx.Lock()
	defer fkv.mtx.Unlock()
	org, ok := fkv.store[orgId]
	if !ok {
		return "", false, nil
	}
	k, ok := org[namespace]
	if !ok {
		return "", false, nil
	}

	v, ok := k[key]
	if !ok {
		return "", false, nil
	}

	return v, true, nil
}
func (fkv *FakeKVStore) Set(_ context.Context, orgId int64, namespace string, key string, value string) error {
	fkv.mtx.Lock()
	defer fkv.mtx.Unlock()
	org, ok := fkv.store[orgId]
	if !ok {
		fkv.store[orgId] = map[string]map[string]string{}
	}
	_, ok = org[namespace]
	if !ok {
		fkv.store[orgId][namespace] = map[string]string{}
	}

	fkv.store[orgId][namespace][key] = value

	return nil
}
func (fkv *FakeKVStore) Del(_ context.Context, orgId int64, namespace string, key string) error {
	fkv.mtx.Lock()
	defer fkv.mtx.Unlock()
	org, ok := fkv.store[orgId]
	if !ok {
		return nil
	}
	_, ok = org[namespace]
	if !ok {
		return nil
	}

	delete(fkv.store[orgId][namespace], key)

	return nil
}

func (fkv *FakeKVStore) Keys(ctx context.Context, orgID int64, namespace string, keyPrefix string) ([]kvstore.Key, error) {
	fkv.mtx.Lock()
	defer fkv.mtx.Unlock()
	var keys []kvstore.Key
	for orgIDFromStore, namespaceMap := range fkv.store {
		if orgID != kvstore.AllOrganizations && orgID != orgIDFromStore {
			continue
		}
		if keyMap, exists := namespaceMap[namespace]; exists {
			for k := range keyMap {
				if strings.HasPrefix(k, keyPrefix) {
					keys = append(keys, kvstore.Key{
						OrgId:     orgIDFromStore,
						Namespace: namespace,
						Key:       keyPrefix,
					})
				}
			}
		}
	}
	return keys, nil
}

func (fkv *FakeKVStore) GetAll(ctx context.Context, orgId int64, namespace string) (map[int64]map[string]string, error) {
	return nil, nil
}

type fakeState struct {
	data string
}

func (fs *fakeState) MarshalBinary() ([]byte, error) {
	return []byte(fs.data), nil
}

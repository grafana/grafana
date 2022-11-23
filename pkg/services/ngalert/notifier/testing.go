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

// fakeConfigStore is a fake for the actual persistence layer.
// It's unexported to enforce the use of the factory function, which initializes the mutex.
type fakeConfigStore struct {
	// configsByOrg maps an orgID with its saved configurations.
	configsByOrg map[int64][]*models.AlertConfiguration

	// configByID maps an ID to its corresponding configuration.
	configByID map[int64]*models.AlertConfiguration

	lastID int64
	mtx    *sync.RWMutex
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

func NewFakeConfigStore(t *testing.T, configsByOrg map[int64][]*models.AlertConfiguration) *fakeConfigStore {
	t.Helper()

	// Add unique IDs to the configs.
	var id int64
	configByID := make(map[int64]*models.AlertConfiguration)
	for _, configs := range configsByOrg {
		for _, config := range configs {
			id++
			config.ID = id
			configByID[id] = config
		}
	}

	fcs := fakeConfigStore{
		mtx:          &sync.RWMutex{},
		configsByOrg: configsByOrg,
		configByID:   configByID,
		lastID:       id,
	}

	return &fcs
}

func (f *fakeConfigStore) GetAllLatestAlertmanagerConfiguration(context.Context) ([]*models.AlertConfiguration, error) {
	f.mtx.RLock()
	defer f.mtx.RUnlock()

	result := make([]*models.AlertConfiguration, 0, len(f.configsByOrg))
	for _, configs := range f.configsByOrg {
		result = append(result, configs[len(configs)-1])
	}
	return result, nil
}

func (f *fakeConfigStore) GetLatestAlertmanagerConfiguration(_ context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error {
	f.mtx.RLock()
	defer f.mtx.RUnlock()

	configs, ok := f.configsByOrg[query.OrgID]
	if !ok {
		return store.ErrNoAlertmanagerConfiguration
	}

	query.Result = configs[len(configs)-1]
	return nil
}

func (f *fakeConfigStore) SaveAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	f.configsByOrg[cmd.OrgID] = append(f.configsByOrg[cmd.OrgID], &models.AlertConfiguration{
		ID:                        f.lastID + 1,
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
		SuccessfullyApplied:       cmd.SuccessfullyApplied,
	})
	f.lastID++

	return nil
}

func (f *fakeConfigStore) SaveAlertmanagerConfigurationWithCallback(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) error {
	// This function calls SaveAlertmanagerConfiguration, which tries to acquire a lock.
	// Not using the mutex here in order to avoid deadlocks.
	if err := f.SaveAlertmanagerConfiguration(ctx, cmd); err != nil {
		return err
	}

	if err := callback(); err != nil {
		return err
	}

	return nil
}

func (f *fakeConfigStore) UpdateAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	if configsByOrg, exists := f.configsByOrg[cmd.OrgID]; exists {
		for i, config := range configsByOrg {
			if config.ConfigurationHash == cmd.FetchedConfigurationHash {
				f.configsByOrg[cmd.OrgID][i] = &models.AlertConfiguration{
					AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
					OrgID:                     cmd.OrgID,
					ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
					ConfigurationVersion:      "v1",
					Default:                   cmd.Default,
				}
				return nil
			}
		}
	}

	return errors.New("config not found or hash not valid")
}

func (f *fakeConfigStore) MarkAlertmanagerConfigurationAsSuccessfullyApplied(_ context.Context, configID int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	if config, ok := f.configByID[configID]; ok {
		config.SuccessfullyApplied = true
		return nil
	}

	return errors.New("config not found")
}

func (f *fakeConfigStore) GetSuccessfullyAppliedAlertmanagerConfigurations(_ context.Context, query *models.GetSuccessfullyAppliedAlertmanagerConfigurationsQuery) error {
	f.mtx.RLock()
	defer f.mtx.RUnlock()

	configsByOrg, ok := f.configsByOrg[query.OrgID]
	if !ok {
		query.Result = []*models.AlertConfiguration{}
		return nil
	}

	// Iterating backwards to get the latest successfully applied configs.
	var successfullyAppliedConfigs []*models.AlertConfiguration
	start := len(configsByOrg) - 1
	end := start - query.Limit
	if end < 0 {
		end = 0
	}

	for i := start; i >= end; i-- {
		if configsByOrg[i].SuccessfullyApplied {
			successfullyAppliedConfigs = append(successfullyAppliedConfigs, configsByOrg[i])
		}
	}

	query.Result = successfullyAppliedConfigs

	return nil
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

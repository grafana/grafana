package notifier

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type FakeConfigStore struct {
	configs map[int64]*models.AlertConfiguration
}

func (f *FakeConfigStore) GetURL(ctx context.Context, token string) (string, error) {
	return "", store.ErrImageNotFound
}

func (f *FakeConfigStore) GetFilepath(ctx context.Context, token string) (string, error) {
	return "", store.ErrImageNotFound
}

// Returns an io.ReadCloser that reads out the image data for the provided
// token, if available. May return ErrImageNotFound.
func (f *FakeConfigStore) GetData(ctx context.Context, token string) (io.ReadCloser, error) {
	return nil, store.ErrImageNotFound
}

func NewFakeConfigStore(t *testing.T, configs map[int64]*models.AlertConfiguration) FakeConfigStore {
	t.Helper()

	return FakeConfigStore{
		configs: configs,
	}
}

func (f *FakeConfigStore) GetAllLatestAlertmanagerConfiguration(context.Context) ([]*models.AlertConfiguration, error) {
	result := make([]*models.AlertConfiguration, 0, len(f.configs))
	for _, configuration := range f.configs {
		result = append(result, configuration)
	}
	return result, nil
}

func (f *FakeConfigStore) GetLatestAlertmanagerConfiguration(_ context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error {
	var ok bool
	query.Result, ok = f.configs[query.OrgID]
	if !ok {
		return store.ErrNoAlertmanagerConfiguration
	}

	return nil
}

func (f *FakeConfigStore) SaveAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.configs[cmd.OrgID] = &models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}

	return nil
}

func (f *FakeConfigStore) SaveAlertmanagerConfigurationWithCallback(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) error {
	f.configs[cmd.OrgID] = &models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}

	if err := callback(); err != nil {
		return err
	}

	return nil
}

func (f *FakeConfigStore) UpdateAlertmanagerConfiguration(_ context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
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

type fakeState struct {
	data string
}

func (fs *fakeState) MarshalBinary() ([]byte, error) {
	return []byte(fs.data), nil
}

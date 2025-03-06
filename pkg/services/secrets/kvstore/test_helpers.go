package kvstore

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func NewFakeSQLSecretsKVStore(t *testing.T, sqlStore *sqlstore.SQLStore) *SecretsKVStoreSQL {
	t.Helper()
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	return NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
}

// In memory kv store used for testing
type FakeSecretsKVStore struct {
	store    map[Key]string
	delError bool
	fallback SecretsKVStore
}

func NewFakeSecretsKVStore() *FakeSecretsKVStore {
	return &FakeSecretsKVStore{store: make(map[Key]string)}
}

func (f *FakeSecretsKVStore) DeletionError(shouldErr bool) {
	f.delError = shouldErr
}

func (f *FakeSecretsKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	value := f.store[buildKey(orgId, namespace, typ)]
	found := value != ""
	return value, found, nil
}

func (f *FakeSecretsKVStore) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	f.store[buildKey(orgId, namespace, typ)] = value
	return nil
}

func (f *FakeSecretsKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	if f.delError {
		return errors.New("mocked del error")
	}
	delete(f.store, buildKey(orgId, namespace, typ))
	return nil
}

// List all keys with an optional filter. If default values are provided, filter is not applied.
func (f *FakeSecretsKVStore) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	res := make([]Key, 0)
	for k := range f.store {
		if orgId == AllOrganizations && namespace == "" && typ == "" {
			res = append(res, k)
		} else if k.OrgId == orgId && k.Namespace == namespace && k.Type == typ {
			res = append(res, k)
		}
	}
	return res, nil
}

func (f *FakeSecretsKVStore) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	f.store[buildKey(orgId, newNamespace, typ)] = f.store[buildKey(orgId, namespace, typ)]
	delete(f.store, buildKey(orgId, namespace, typ))
	return nil
}

func (f *FakeSecretsKVStore) GetAll(ctx context.Context) ([]Item, error) {
	items := make([]Item, 0)
	for k := range f.store {
		orgId := k.OrgId
		namespace := k.Namespace
		typ := k.Type
		items = append(items, Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
			Value:     f.store[k],
		})
	}
	return items, nil
}

func (f *FakeSecretsKVStore) Fallback() SecretsKVStore {
	return f.fallback
}

func (f *FakeSecretsKVStore) SetFallback(store SecretsKVStore) error {
	f.fallback = store
	return nil
}

func buildKey(orgId int64, namespace string, typ string) Key {
	return Key{
		OrgId:     orgId,
		Namespace: namespace,
		Type:      typ,
	}
}

// Fake feature toggle - only need to check the backwards compatibility disabled flag
type fakeFeatureToggles struct {
	returnValue bool
}

func NewFakeFeatureToggles(t *testing.T, returnValue bool) featuremgmt.FeatureToggles {
	t.Helper()
	return fakeFeatureToggles{
		returnValue: returnValue,
	}
}

func (f fakeFeatureToggles) IsEnabledGlobally(feature string) bool {
	return f.returnValue
}

func (f fakeFeatureToggles) IsEnabled(ctx context.Context, feature string) bool {
	return f.returnValue
}

func (f fakeFeatureToggles) GetEnabled(ctx context.Context) map[string]bool {
	return map[string]bool{}
}

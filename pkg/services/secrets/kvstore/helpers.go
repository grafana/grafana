package kvstore

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func SetupTestService(t *testing.T) SecretsKVStore {
	t.Helper()

	sqlStore := sqlstore.InitTestDB(t)
	store := database.ProvideSecretsStore(sqlstore.InitTestDB(t))
	secretsService := manager.SetupTestService(t, store)

	kv := &secretsKVStoreSQL{
		sqlStore:       sqlStore,
		log:            log.New("secrets.kvstore"),
		secretsService: secretsService,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}

	return kv
}

// Helpers to determine whether plugin startup failures are fatal to the app
func GetNamespacedKVStore(kv kvstore.KVStore) *kvstore.NamespacedKVStore {
	return kvstore.WithNamespace(kv, kvstore.AllOrganizations, PluginNamespace)
}

func isPluginErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore) (bool, error) {
	_, exists, err := kvstore.Get(ctx, QuitOnPluginStartupFailureKey)
	if err != nil {
		return true, errors.New(fmt.Sprint("error retrieving key ", QuitOnPluginStartupFailureKey, " from kvstore. error: ", err.Error()))
	}
	return exists, nil
}

func setPluginErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore, isFatal bool) error {
	if !isFatal {
		return kvstore.Del(ctx, QuitOnPluginStartupFailureKey)
	}
	return kvstore.Set(ctx, QuitOnPluginStartupFailureKey, "true")
}

// In memory kv store used for testing
type FakeSecretsKVStore struct {
	store map[Key]string
}

func NewFakeSecretsKVStore() FakeSecretsKVStore {
	return FakeSecretsKVStore{store: make(map[Key]string)}
}

func (f FakeSecretsKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	value := f.store[buildKey(orgId, namespace, typ)]
	found := value != ""
	return value, found, nil
}

func (f FakeSecretsKVStore) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	f.store[buildKey(orgId, namespace, typ)] = value
	return nil
}

func (f FakeSecretsKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	delete(f.store, buildKey(orgId, namespace, typ))
	return nil
}

func (f FakeSecretsKVStore) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	res := make([]Key, 0)
	for k := range f.store {
		if k.OrgId == orgId && k.Namespace == namespace && k.Type == typ {
			res = append(res, k)
		}
	}
	return res, nil
}

func (f FakeSecretsKVStore) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	f.store[buildKey(orgId, newNamespace, typ)] = f.store[buildKey(orgId, namespace, typ)]
	delete(f.store, buildKey(orgId, namespace, typ))
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

func (f fakeFeatureToggles) IsEnabled(feature string) bool {
	return f.returnValue
}

var _ SecretsKVStore = FakeSecretsKVStore{}

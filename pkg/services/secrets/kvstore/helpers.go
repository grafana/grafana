package kvstore

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
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

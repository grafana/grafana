package kvstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	// Wildcard to query all organizations
	AllOrganizations = -1
)

func ProvideService(
	sqlStore sqlstore.Store,
	secretsService secrets.Service,
	remoteCheck UseRemoteSecretsPluginCheck,
	kvstore kvstore.KVStore,
	features featuremgmt.FeatureToggles,
) (SecretsKVStore, error) {
	var store SecretsKVStore
	logger := log.New("secrets.kvstore")
	store = &secretsKVStoreSQL{
		sqlStore:       sqlStore,
		secretsService: secretsService,
		log:            logger,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}
	if remoteCheck.ShouldUseRemoteSecretsPlugin() {
		// Attempt to start the plugin
		secretsPlugin, err := remoteCheck.StartAndReturnPlugin(context.Background())
		namespacedKVStore := GetNamespacedKVStore(kvstore)
		if err != nil || secretsPlugin == nil {
			if isFatal, err2 := isPluginStartupErrorFatal(context.Background(), namespacedKVStore); isFatal || err2 != nil {
				// plugin error was fatal or there was an error determining if the error was fatal
				logger.Error("secrets management plugin is required to start -- exiting app")
				if err2 != nil {
					// TODO decide whether an error here should actually crash the app
					return nil, err2
				}
				return nil, err
			}
			logger.Error("error starting secrets plugin, falling back to SQL implementation")
		} else {
			store = &secretsKVStorePlugin{
				secretsPlugin:                  secretsPlugin,
				secretsService:                 secretsService,
				log:                            logger,
				kvstore:                        namespacedKVStore,
				backwardsCompatibilityDisabled: features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility),
			}
		}
	} else {
		logger.Debug("secrets kvstore is using the default (SQL) implementation for secrets management")
	}

	return NewCachedKVStore(store, 5*time.Second, 5*time.Minute), nil
}

// SecretsKVStore is an interface for k/v store.
type SecretsKVStore interface {
	Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error)
	Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error
	Del(ctx context.Context, orgId int64, namespace string, typ string) error
	Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error)
	Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error
}

// WithType returns a kvstore wrapper with fixed orgId and type.
func With(kv SecretsKVStore, orgId int64, namespace string, typ string) *FixedKVStore {
	return &FixedKVStore{
		kvStore:   kv,
		OrgId:     orgId,
		Namespace: namespace,
		Type:      typ,
	}
}

// FixedKVStore is a SecretsKVStore wrapper with fixed orgId, namespace and type.
type FixedKVStore struct {
	kvStore   SecretsKVStore
	OrgId     int64
	Namespace string
	Type      string
}

func (kv *FixedKVStore) Get(ctx context.Context) (string, bool, error) {
	return kv.kvStore.Get(ctx, kv.OrgId, kv.Namespace, kv.Type)
}

func (kv *FixedKVStore) Set(ctx context.Context, value string) error {
	return kv.kvStore.Set(ctx, kv.OrgId, kv.Namespace, kv.Type, value)
}

func (kv *FixedKVStore) Del(ctx context.Context) error {
	return kv.kvStore.Del(ctx, kv.OrgId, kv.Namespace, kv.Type)
}

func (kv *FixedKVStore) Keys(ctx context.Context) ([]Key, error) {
	return kv.kvStore.Keys(ctx, kv.OrgId, kv.Namespace, kv.Type)
}

func (kv *FixedKVStore) Rename(ctx context.Context, newNamespace string) error {
	err := kv.kvStore.Rename(ctx, kv.OrgId, kv.Namespace, kv.Type, newNamespace)
	if err != nil {
		return err
	}
	kv.Namespace = newNamespace
	return nil
}

// Helpers to determine whether plugin startup failures are fatal to the app
func GetNamespacedKVStore(kv kvstore.KVStore) *kvstore.NamespacedKVStore {
	return kvstore.WithNamespace(kv, kvstore.AllOrganizations, PluginNamespace)
}

func isPluginStartupErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore) (bool, error) {
	_, exists, err := kvstore.Get(ctx, QuitOnPluginStartupFailureKey)
	if err != nil {
		return false, errors.New(fmt.Sprint("error retrieving key ", QuitOnPluginStartupFailureKey, " from kvstore. error: ", err.Error()))
	}
	return exists, nil
}

func setPluginStartupErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore, isFatal bool) error {
	if !isFatal {
		return kvstore.Del(ctx, QuitOnPluginStartupFailureKey)
	}
	return kvstore.Set(ctx, QuitOnPluginStartupFailureKey, "true")
}

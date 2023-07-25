package kvstore

import (
	"context"
	"time"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// SecretsKVStore is an interface for k/v store.
type SecretsKVStore interface {
	Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error)
	Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error
	Del(ctx context.Context, orgId int64, namespace string, typ string) error
	Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error)
	Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error
	GetAll(ctx context.Context) ([]Item, error)
}

// Runner is a service that initializes the SecretsKVStore.
type Runner interface {
	services.NamedService
}

type service struct {
	*services.BasicService
	log            log.Logger
	store          SecretsKVStore
	sqlStore       db.DB
	secretsService secrets.Service
	pluginsManager plugins.SecretsPluginManager
	kvstore        kvstore.KVStore
	features       featuremgmt.FeatureToggles
	cfg            *setting.Cfg
}

var _ SecretsKVStore = (*service)(nil)
var _ Runner = (*service)(nil)

func ProvideService(
	sqlStore db.DB,
	secretsService secrets.Service,
	pluginsManager plugins.SecretsPluginManager,
	kvstore kvstore.KVStore,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
) (*service, error) {
	s := &service{
		log:            log.New("secrets.kvstore"),
		sqlStore:       sqlStore,
		secretsService: secretsService,
		pluginsManager: pluginsManager,
		kvstore:        kvstore,
		features:       features,
		cfg:            cfg,
	}
	s.BasicService = services.NewIdleService(s.starting, nil).WithName(modules.SecretsKVStore)
	return s, nil
}

func (s *service) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return "", false, err
	}
	return s.store.Get(ctx, orgId, namespace, typ)
}

func (s *service) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	// wait for the service to be healthy before attempting to access the store
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return err
	}
	return s.store.Set(ctx, orgId, namespace, typ, value)
}

func (s *service) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	// wait for the service to be healthy before attempting to access the store
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return err
	}
	return s.store.Del(ctx, orgId, namespace, typ)
}

func (s *service) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	// wait for the service to be healthy before attempting to access the store
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return nil, err
	}
	return s.store.Keys(ctx, orgId, namespace, typ)
}

func (s *service) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	// wait for the service to be healthy before attempting to access the store
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return err
	}
	return s.store.Rename(ctx, orgId, namespace, typ, newNamespace)
}

func (s *service) GetAll(ctx context.Context) ([]Item, error) {
	// wait for the service to be healthy before attempting to access the store
	if err := s.BasicService.AwaitRunning(ctx); err != nil {
		return nil, err
	}
	return s.store.GetAll(ctx)
}

func (s *service) starting(ctx context.Context) error {
	// check if the plugin is installed and enabled
	if err := EvaluateRemoteSecretsPlugin(ctx, s.pluginsManager, s.cfg); err != nil {
		s.log.Debug("secrets manager evaluator returned false", "reason", err.Error())
		// use the sql store if a plugin is not enabeld or installed
		s.store = s.getSQLStore()
		return nil
	}

	// if the plugin is available, start it and use it
	pluginStore, err := s.getPluginStore(ctx)
	if err != nil {
		return err
	}

	if pluginStore != nil {
		s.store = pluginStore
		return nil
	}

	// if the plugin is not available, use the sql store
	s.log.Debug("secrets kvstore is using the default (SQL) implementation for secrets management")
	s.store = s.getSQLStore()

	return nil
}

func (s *service) getSQLStore() SecretsKVStore {
	store := NewSQLSecretsKVStore(s.sqlStore, s.secretsService, s.log)
	return WithCache(store, 5*time.Second, 5*time.Minute)
}

func (s *service) getPluginStore(ctx context.Context) (SecretsKVStore, error) {
	namespacedKVStore := GetNamespacedKVStore(s.kvstore)

	// attempt to start the plugin
	secretsPlugin, err := StartAndReturnPlugin(s.pluginsManager, ctx)
	if err != nil || secretsPlugin == nil {
		s.log.Error("failed to start remote secrets management plugin")
		if isFatal, readErr := IsPluginStartupErrorFatal(ctx, namespacedKVStore); isFatal || readErr != nil {
			// plugin error was fatal or there was an error determining if the error was fatal
			s.log.Error("secrets management plugin is required to start -- exiting app")
			if readErr != nil {
				return nil, readErr
			}
			return nil, err
		}
		return nil, nil
	}

	// as the plugin is installed, SecretsKVStoreSQL is now replaced with
	// an instance of SecretsKVStorePlugin with the sql store as a fallback
	// (used for migration and in case a secret is not found).
	return NewPluginSecretsKVStore(secretsPlugin, s.secretsService, namespacedKVStore, s.features, s.getSQLStore(), s.log), nil
}

func GetUnwrappedStore(kv SecretsKVStore) (SecretsKVStore, error) {
	if s, ok := kv.(*service); ok {
		return s.store, nil
	}
	if cache, ok := kv.(*CachedKVStore); ok {
		return cache.store, nil
	}
	return nil, errSecretStoreIsNotCached
}

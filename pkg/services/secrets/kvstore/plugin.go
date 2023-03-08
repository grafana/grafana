package kvstore

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	smp "github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	fatalFlagOnce             sync.Once
	startupOnce               sync.Once
	errPluginDisabledByConfig = errors.New("remote secret management plugin disabled because the property `secrets.use_plugin` is not set to `true`")
	errPluginNotInstalled     = errors.New("remote secret management plugin disabled because there is no installed plugin of type `secretsmanager`")
)

// SecretsKVStorePlugin provides a key/value store backed by the Grafana plugin gRPC interface
type SecretsKVStorePlugin struct {
	sync.Mutex
	log                            log.Logger
	secretsPlugin                  smp.SecretsManagerPlugin
	secretsService                 secrets.Service
	kvstore                        *kvstore.NamespacedKVStore
	backwardsCompatibilityDisabled bool
	fallbackEnabled                bool
	fallbackStore                  SecretsKVStore
}

func NewPluginSecretsKVStore(
	secretsPlugin smp.SecretsManagerPlugin,
	secretsService secrets.Service,
	kvstore *kvstore.NamespacedKVStore,
	features featuremgmt.FeatureToggles,
	fallback SecretsKVStore,
	logger log.Logger,
) *SecretsKVStorePlugin {
	return &SecretsKVStorePlugin{
		secretsPlugin:                  secretsPlugin,
		secretsService:                 secretsService,
		log:                            logger,
		kvstore:                        kvstore,
		backwardsCompatibilityDisabled: features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility),
		fallbackStore:                  fallback,
	}
}

// Get an item from the store
// If it is the first time a secret has been retrieved and backwards compatibility is disabled, mark plugin startup errors fatal
func (kv *SecretsKVStorePlugin) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	req := &smp.GetSecretRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
	}

	res, err := kv.secretsPlugin.GetSecret(ctx, req)
	if res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	if res.Exists {
		updateFatalFlag(ctx, kv)
	}

	if kv.fallbackEnabled {
		if err != nil || res.UserFriendlyError != "" || !res.Exists {
			res.DecryptedValue, res.Exists, err = kv.fallbackStore.Get(ctx, orgId, namespace, typ)
		}
	}

	return res.DecryptedValue, res.Exists, err
}

// Set an item in the store
// If it is the first time a secret has been set and backwards compatibility is disabled, mark plugin startup errors fatal
func (kv *SecretsKVStorePlugin) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	req := &smp.SetSecretRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		Value: value,
	}

	res, err := kv.secretsPlugin.SetSecret(ctx, req)
	if err == nil && res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	updateFatalFlag(ctx, kv)

	return err
}

// Del deletes an item from the store.
func (kv *SecretsKVStorePlugin) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	req := &smp.DeleteSecretRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
	}

	res, err := kv.secretsPlugin.DeleteSecret(ctx, req)
	if err == nil && res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	return err
}

// Keys get all keys for a given namespace. To query for all
// organizations the constant 'kvstore.AllOrganizations' can be passed as orgId.
func (kv *SecretsKVStorePlugin) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	req := &smp.ListSecretsRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		AllOrganizations: orgId == AllOrganizations,
	}

	res, err := kv.secretsPlugin.ListSecrets(ctx, req)
	if err != nil {
		return nil, err
	} else if res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	return parseKeys(res.Keys), err
}

// Rename an item in the store
func (kv *SecretsKVStorePlugin) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	req := &smp.RenameSecretRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		NewNamespace: newNamespace,
	}

	res, err := kv.secretsPlugin.RenameSecret(ctx, req)
	if err == nil && res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	return err
}

func (kv *SecretsKVStorePlugin) GetAll(ctx context.Context) ([]Item, error) {
	req := &smp.GetAllSecretsRequest{}

	res, err := kv.secretsPlugin.GetAllSecrets(ctx, req)
	if err != nil {
		return nil, err
	} else if res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	return parseItems(res.Items), err
}

func (kv *SecretsKVStorePlugin) Fallback() SecretsKVStore {
	return kv.fallbackStore
}

func (kv *SecretsKVStorePlugin) WithFallbackEnabled(fn func() error) error {
	kv.Lock()
	defer kv.Unlock()
	kv.fallbackEnabled = true
	err := fn()
	kv.fallbackEnabled = false
	return err
}

func parseKeys(keys []*smp.Key) []Key {
	newKeys := make([]Key, 0, len(keys))

	for _, k := range keys {
		newKey := Key{OrgId: k.OrgId, Namespace: k.Namespace, Type: k.Type}
		newKeys = append(newKeys, newKey)
	}

	return newKeys
}

func parseItems(items []*smp.Item) []Item {
	newItems := make([]Item, 0, len(items))

	for _, i := range items {
		newItem := Item{OrgId: &i.Key.OrgId, Namespace: &i.Key.Namespace, Type: &i.Key.Type, Value: i.Value}
		newItems = append(newItems, newItem)
	}

	return newItems
}

func updateFatalFlag(ctx context.Context, skv *SecretsKVStorePlugin) {
	// This function makes the most sense in here because it handles all possible scenarios:
	//   - User changed backwards compatibility flag, so we have to migrate secrets either to or from the plugin (get or set)
	//   - Migration is on, so we migrate secrets to the plugin (set)
	//   - User doesn't migrate, but stores a new secret in the plugin (set)
	// Rather than updating the flag in several places, it is cleaner to just do this check once
	// Very early on. Once backwards compatibility to legacy secrets is gone in Grafana 10, this can go away as well
	fatalFlagOnce.Do(func() {
		skv.log.Debug("Updating plugin startup error fatal flag")
		var err error
		if isFatal, _ := IsPluginStartupErrorFatal(ctx, skv.kvstore); !isFatal && skv.backwardsCompatibilityDisabled {
			err = SetPluginStartupErrorFatal(ctx, skv.kvstore, true)
		} else if isFatal && !skv.backwardsCompatibilityDisabled {
			err = SetPluginStartupErrorFatal(ctx, skv.kvstore, false)
		}
		if err != nil {
			skv.log.Error("failed to set plugin error fatal flag", err.Error())
		}
	})
}

func wrapUserFriendlySecretError(ufe string) datasources.ErrDatasourceSecretsPluginUserFriendly {
	return datasources.ErrDatasourceSecretsPluginUserFriendly{Err: ufe}
}

func GetNamespacedKVStore(kv kvstore.KVStore) *kvstore.NamespacedKVStore {
	return kvstore.WithNamespace(kv, kvstore.AllOrganizations, PluginNamespace)
}

func IsPluginStartupErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore) (bool, error) {
	_, exists, err := kvstore.Get(ctx, QuitOnPluginStartupFailureKey)
	if err != nil {
		return false, fmt.Errorf("error retrieving key %s from kvstore. error: %w", QuitOnPluginStartupFailureKey, err)
	}
	return exists, nil
}

func SetPluginStartupErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore, isFatal bool) error {
	if !isFatal {
		return kvstore.Del(ctx, QuitOnPluginStartupFailureKey)
	}
	return kvstore.Set(ctx, QuitOnPluginStartupFailureKey, "true")
}

func EvaluateRemoteSecretsPlugin(ctx context.Context, mg plugins.SecretsPluginManager, cfg *setting.Cfg) error {
	usePlugin := cfg.SectionWithEnvOverrides("secrets").Key("use_plugin").MustBool()
	if !usePlugin {
		return errPluginDisabledByConfig
	}
	pluginInstalled := mg.SecretsManager(ctx) != nil
	if !pluginInstalled {
		return errPluginNotInstalled
	}
	return nil
}

func HasPluginStarted(ctx context.Context, mg plugins.SecretsPluginManager) bool {
	return mg.SecretsManager(ctx) != nil && mg.SecretsManager(ctx).SecretsManager != nil
}

func StartAndReturnPlugin(mg plugins.SecretsPluginManager, ctx context.Context) (smp.SecretsManagerPlugin, error) {
	var err error
	startupOnce.Do(func() {
		err = mg.SecretsManager(ctx).Start(ctx)
	})
	if err != nil {
		return nil, err
	}
	return mg.SecretsManager(ctx).SecretsManager, nil
}

func ResetPlugin() {
	fatalFlagOnce = sync.Once{}
	startupOnce = sync.Once{}
}

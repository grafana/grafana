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
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	fatalFlagOnce             sync.Once
	startupOnce               sync.Once
	errPluginDisabledByConfig = errors.New("remote secret managements plugin disabled because the property `secrets.use_plugin` is not set to `true`")
	errPluginNotInstalled     = errors.New("remote secret managements plugin disabled because there is no installed plugin of type `secretsmanager`")
)

// secretsKVStorePlugin provides a key/value store backed by the Grafana plugin gRPC interface
type secretsKVStorePlugin struct {
	log                            log.Logger
	secretsPlugin                  smp.SecretsManagerPlugin
	secretsService                 secrets.Service
	kvstore                        *kvstore.NamespacedKVStore
	backwardsCompatibilityDisabled bool
	fallback                       SecretsKVStore
}

// Get an item from the store
// If it is the first time a secret has been retrieved and backwards compatibility is disabled, mark plugin startup errors fatal
func (kv *secretsKVStorePlugin) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	req := &smp.GetSecretRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
	}
	res, err := kv.secretsPlugin.GetSecret(ctx, req)
	if err != nil {
		return "", false, err
	} else if res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	if res.Exists {
		updateFatalFlag(ctx, *kv)
	}

	return res.DecryptedValue, res.Exists, err
}

// Set an item in the store
// If it is the first time a secret has been set and backwards compatibility is disabled, mark plugin startup errors fatal
func (kv *secretsKVStorePlugin) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
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

	updateFatalFlag(ctx, *kv)

	return err
}

// Del deletes an item from the store.
func (kv *secretsKVStorePlugin) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
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
func (kv *secretsKVStorePlugin) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
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
func (kv *secretsKVStorePlugin) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
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

func (kv *secretsKVStorePlugin) GetAll(ctx context.Context) ([]Item, error) {
	req := &smp.GetAllSecretsRequest{}

	res, err := kv.secretsPlugin.GetAllSecrets(ctx, req)
	if err != nil {
		return nil, err
	} else if res.UserFriendlyError != "" {
		err = wrapUserFriendlySecretError(res.UserFriendlyError)
	}

	return parseItems(res.Items), err
}

func (kv *secretsKVStorePlugin) Fallback() SecretsKVStore {
	return kv.fallback
}

func (kv *secretsKVStorePlugin) SetFallback(store SecretsKVStore) error {
	kv.fallback = store
	return nil
}

func parseKeys(keys []*smp.Key) []Key {
	var newKeys []Key

	for _, k := range keys {
		newKey := Key{OrgId: k.OrgId, Namespace: k.Namespace, Type: k.Type}
		newKeys = append(newKeys, newKey)
	}

	return newKeys
}

func parseItems(items []*smp.Item) []Item {
	var newItems []Item

	for _, i := range items {
		newItem := Item{OrgId: &i.Key.OrgId, Namespace: &i.Key.Namespace, Type: &i.Key.Type, Value: i.Value}
		newItems = append(newItems, newItem)
	}

	return newItems
}

func updateFatalFlag(ctx context.Context, skv secretsKVStorePlugin) {
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
		return false, errors.New(fmt.Sprint("error retrieving key ", QuitOnPluginStartupFailureKey, " from kvstore. error: ", err.Error()))
	}
	return exists, nil
}

func SetPluginStartupErrorFatal(ctx context.Context, kvstore *kvstore.NamespacedKVStore, isFatal bool) error {
	if !isFatal {
		return kvstore.Del(ctx, QuitOnPluginStartupFailureKey)
	}
	return kvstore.Set(ctx, QuitOnPluginStartupFailureKey, "true")
}

func EvaluateRemoteSecretsPlugin(mg plugins.SecretsPluginManager, cfg *setting.Cfg) error {
	usePlugin := cfg.SectionWithEnvOverrides("secrets").Key("use_plugin").MustBool()
	if !usePlugin {
		return errPluginDisabledByConfig
	}
	pluginInstalled := mg.SecretsManager() != nil
	if !pluginInstalled {
		return errPluginNotInstalled
	}
	return nil
}

func StartAndReturnPlugin(mg plugins.SecretsPluginManager, ctx context.Context) (smp.SecretsManagerPlugin, error) {
	var err error
	startupOnce.Do(func() {
		err = mg.SecretsManager().Start(ctx)
	})
	if err != nil {
		return nil, err
	}
	return mg.SecretsManager().SecretsManager, nil
}

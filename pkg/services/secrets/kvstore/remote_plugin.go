package kvstore

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	smp "github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	fatalFlagOnce sync.Once
)

// secretsKVStorePlugin provides a key/value store backed by the Grafana plugin gRPC interface
type secretsKVStorePlugin struct {
	log                            log.Logger
	secretsPlugin                  smp.SecretsManagerPlugin
	secretsService                 secrets.Service
	kvstore                        *kvstore.NamespacedKVStore
	backwardsCompatibilityDisabled bool
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

func parseKeys(keys []*smp.Key) []Key {
	var newKeys []Key

	for _, k := range keys {
		newKey := Key{OrgId: k.OrgId, Namespace: k.Namespace, Type: k.Type}
		newKeys = append(newKeys, newKey)
	}

	return newKeys
}

func updateFatalFlag(ctx context.Context, skv secretsKVStorePlugin) {
	// This function makes the most sense in here because it handles all possible scenarios:
	//   - User changed backwards compatibility flag, so we have to migrate secrets either to or from the plugin (get or set)
	//   - Migration is on, so we migrate secrets to the plugin (set)
	//   - User doesn't migrate, but stores a new secret in the plugin (set)
	// Rather than updating the flag in several places, it is cleaner to just do this check once
	// Very early on. Once backwards compatibility to legacy secrets is gone in Grafana 10, this can go away as well
	fatalFlagOnce.Do(func() {
		var err error
		if isFatal, _ := isPluginStartupErrorFatal(ctx, skv.kvstore); !isFatal && skv.backwardsCompatibilityDisabled {
			err = setPluginStartupErrorFatal(ctx, skv.kvstore, true)
		} else if isFatal && !skv.backwardsCompatibilityDisabled {
			err = setPluginStartupErrorFatal(ctx, skv.kvstore, false)
		}
		if err != nil {
			skv.log.Error("failed to set plugin error fatal flag", err.Error())
		}
	})
}

func wrapUserFriendlySecretError(ufe string) datasources.ErrDatasourceSecretsPluginUserFriendly {
	return datasources.ErrDatasourceSecretsPluginUserFriendly{Err: ufe}
}

package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	smp "github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/secrets"
)

// secretsKVStorePlugin provides a key/value store backed by the Grafana plugin gRPC interface
type secretsKVStorePlugin struct {
	log            log.Logger
	secretsPlugin  smp.SecretsManagerPlugin
	secretsService secrets.Service
}

// Get an item from the store
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

	return res.DecryptedValue, res.Exists, err
}

// Set an item in the store
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

func wrapUserFriendlySecretError(ufe string) datasources.ErrDatasourceSecretsPluginUserFriendly {
	return datasources.ErrDatasourceSecretsPluginUserFriendly{Err: ufe}
}

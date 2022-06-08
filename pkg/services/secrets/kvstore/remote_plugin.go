package kvstore

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	smp "github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
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
	req := &smp.SecretsGetRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
	}
	res, err := kv.secretsPlugin.Get(ctx, req)
	if err != nil {
		return "", false, err
	} else if res.Error != "" {
		err = fmt.Errorf(res.Error)
	}

	return res.DecryptedValue, res.Exists, err
}

// Set an item in the store
func (kv *secretsKVStorePlugin) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	req := &smp.SecretsSetRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		Value: value,
	}

	res, err := kv.secretsPlugin.Set(ctx, req)
	if err == nil && res.Error != "" {
		err = fmt.Errorf(res.Error)
	}

	return err
}

// Del deletes an item from the store.
func (kv *secretsKVStorePlugin) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	req := &smp.SecretsDelRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
	}

	res, err := kv.secretsPlugin.Del(ctx, req)
	if err == nil && res.Error != "" {
		err = fmt.Errorf(res.Error)
	}

	return err
}

// Keys get all keys for a given namespace. To query for all
// organizations the constant 'kvstore.AllOrganizations' can be passed as orgId.
func (kv *secretsKVStorePlugin) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	req := &smp.SecretsKeysRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		AllOrganizations: orgId == AllOrganizations,
	}

	res, err := kv.secretsPlugin.Keys(ctx, req)
	if err != nil {
		return nil, err
	} else if res.Error != "" {
		err = fmt.Errorf(res.Error)
	}

	return parseKeys(res.Keys), err
}

// Rename an item in the store
func (kv *secretsKVStorePlugin) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	req := &smp.SecretsRenameRequest{
		KeyDescriptor: &smp.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		NewNamespace: newNamespace,
	}

	res, err := kv.secretsPlugin.Rename(ctx, req)
	if err == nil && res.Error != "" {
		err = fmt.Errorf(res.Error)
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

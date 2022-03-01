package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	// Wildcard to query all organizations
	AllOrganizations = -1
)

func ProvideService(sqlStore sqlstore.Store, secretsService secrets.Service) SecretsKVStore {
	return &secretsKVStoreSQL{
		sqlStore:       sqlStore,
		secretsService: secretsService,
		log:            log.New("secrets.kvstore"),
	}
}

// SecretsKVStore is an interface for k/v store.
type SecretsKVStore interface {
	Get(ctx context.Context, orgId int64, typ string, key string) (string, bool, error)
	Set(ctx context.Context, orgId int64, typ string, key string, value string) error
	Del(ctx context.Context, orgId int64, typ string, key string) error
	Keys(ctx context.Context, orgId int64, typ string, keyPrefix string) ([]Key, error)
}

// WithType returns a kvstore wrapper with fixed orgId and type.
func WithType(kv SecretsKVStore, orgId int64, typ string) *TypedKVStore {
	return &TypedKVStore{
		kvStore: kv,
		OrgId:   orgId,
		Type:    typ,
	}
}

// TypedKVStore is a SecretsKVStore wrapper with fixed orgId and type.
type TypedKVStore struct {
	kvStore SecretsKVStore
	OrgId   int64
	Type    string
}

func (kv *TypedKVStore) Get(ctx context.Context, key string) (string, bool, error) {
	return kv.kvStore.Get(ctx, kv.OrgId, kv.Type, key)
}

func (kv *TypedKVStore) Set(ctx context.Context, key string, value string) error {
	return kv.kvStore.Set(ctx, kv.OrgId, kv.Type, key, value)
}

func (kv *TypedKVStore) Del(ctx context.Context, key string) error {
	return kv.kvStore.Del(ctx, kv.OrgId, kv.Type, key)
}

func (kv *TypedKVStore) Keys(ctx context.Context, keyPrefix string) ([]Key, error) {
	return kv.kvStore.Keys(ctx, kv.OrgId, kv.Type, keyPrefix)
}

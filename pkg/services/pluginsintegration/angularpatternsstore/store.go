package angularpatternsstore

import (
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/cachekvstore"
)

type Service interface {
	cachekvstore.SingleKeyStore
}

const (
	kvNamespace = "plugin.angularpatterns"

	keyPatterns = "angular_patterns"
)

// KVStoreService allows to cache GCOM angular patterns into the database, as a cache.
type KVStoreService struct {
	cachekvstore.SingleKeyStore
}

var _ Service = (*KVStoreService)(nil)

func ProvideService(kv kvstore.KVStore) Service {
	return &KVStoreService{
		SingleKeyStore: cachekvstore.NewSingleKeyNamespacedStore(kv, kvNamespace, keyPatterns),
	}
}

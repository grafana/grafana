package keystore

import (
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/cachekvstore"
)

// Service is a service for storing and retrieving public keys.
type Service struct {
	*cachekvstore.NamespacedStore
}

const (
	namespace = "plugin.publickeys"
	prefix    = "key-"
)

var _ plugins.KeyStore = (*Service)(nil)

func ProvideService(kv kvstore.KVStore) *Service {
	return &Service{
		NamespacedStore: cachekvstore.NewNamespacedStore(
			kv, namespace,
			cachekvstore.WithStoreKeyGetter(cachekvstore.PrefixStoreKeyGetter(prefix)),
		),
	}
}

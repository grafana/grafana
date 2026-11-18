package pluginroute

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/types"
	utilcache "k8s.io/apimachinery/pkg/util/cache"

	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

type secureValueCacheKey struct {
	uid types.UID
	rv  string
}

type secureValueLookup struct {
	decrypter decrypt.DecryptService
	cache     *utilcache.LRUExpireCache
	ttl       time.Duration
}

func newSecureValueLookup(decrypter decrypt.DecryptService) *secureValueLookup {
	// Secrets can rotate without changing the parent object's resource version.
	cache := utilcache.NewLRUExpireCache(100)
	return &secureValueLookup{decrypter: decrypter, cache: cache, ttl: time.Minute}
}

func (b *secureValueLookup) get(ctx context.Context, obj utils.GrafanaMetaAccessor) (map[string]string, error) {
	sv, err := obj.GetSecureValues()
	if err != nil {
		return nil, err
	}
	if len(sv) < 1 {
		return nil, nil
	}

	if b.decrypter == nil {
		return nil, fmt.Errorf("missing decrypter")
	}
	key := secureValueCacheKey{uid: obj.GetUID(), rv: obj.GetResourceVersion()}
	if key.rv == "" {
		return nil, fmt.Errorf("missing rv")
	}

	if cached, ok := b.cache.Get(key); ok {
		if v, ok := cached.(map[string]string); ok {
			return v, nil
		}
	}

	loader, err := b.loader(ctx, obj)
	if err != nil {
		return nil, err
	}
	v, err := loader(ctx)
	if err != nil {
		return nil, err
	}
	b.cache.Add(key, v, b.ttl)
	return v, err
}

func (b *secureValueLookup) loader(ctx context.Context, obj utils.GrafanaMetaAccessor) (pluginsettings.DecryptedSecureJSONLoader, error) {
	return pluginsettings.GetDecryptedSecureJSONLoader(ctx, obj, b.decrypter)
}

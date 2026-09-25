package appplugin

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/types"

	lru "github.com/hashicorp/golang-lru/v2"

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
	cache     *lru.Cache[secureValueCacheKey, map[string]string]
	now       func() time.Time
}

func newSecureValueLookup(decrypter decrypt.DecryptService) *secureValueLookup {
	cache, err := lru.New[secureValueCacheKey, map[string]string](100)
	if err != nil {
		panic(err)
	}
	return &secureValueLookup{decrypter: decrypter, cache: cache, now: time.Now}
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

	v, ok := b.cache.Get(key)
	if ok {
		return v, nil
	}

	loader, err := b.loader(ctx, obj)
	if err != nil {
		return nil, err
	}
	v, err = loader(ctx)
	if err != nil {
		return nil, err
	}
	_ = b.cache.Add(key, v)
	return v, err
}

// This is used by settings, so keep it for now
func (b *secureValueLookup) loader(ctx context.Context, obj utils.GrafanaMetaAccessor) (pluginsettings.DecryptedSecureJSONLoader, error) {
	return pluginsettings.GetDecryptedSecureJSONLoader(ctx, obj, b.decrypter)
}

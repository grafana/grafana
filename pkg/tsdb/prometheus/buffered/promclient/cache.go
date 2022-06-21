package promclient

import (
	"sort"
	"strings"

	lru "github.com/hashicorp/golang-lru"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type ProviderCache struct {
	provider promClientProvider
	cache    *lru.Cache
}

type promClientProvider interface {
	GetClient(map[string]string) (apiv1.API, error)
}

func NewProviderCache(p promClientProvider) (*ProviderCache, error) {
	cache, err := lru.New(500)
	if err != nil {
		return nil, err
	}

	return &ProviderCache{
		provider: p,
		cache:    cache,
	}, nil
}

func (c *ProviderCache) GetClient(headers map[string]string) (apiv1.API, error) {
	key := c.key(headers)
	if client, ok := c.cache.Get(key); ok {
		return client.(apiv1.API), nil
	}

	client, err := c.provider.GetClient(headers)
	if err != nil {
		return nil, err
	}

	c.cache.Add(key, client)
	return client, nil
}

func (c *ProviderCache) key(headers map[string]string) string {
	vals := make([]string, len(headers))
	var i int
	for _, v := range headers {
		vals[i] = v
		i++
	}
	sort.Strings(vals)
	return strings.Join(vals, "")
}

package contexthandler

import (
	"github.com/patrickmn/go-cache"
	"sync"
)

// Cache Singleton
type OrgCache struct {
	cache *cache.Cache
}

var instance *OrgCache
var once sync.Once

func GetInstance() *OrgCache {
	// Will be executed only once
	once.Do(func() {
		// Create a new cache
		instance = &OrgCache{cache: cache.New(-1, -1)}
	})
	return instance
}

func (c *OrgCache) Get(key string) (interface{}, bool) {
	return c.cache.Get(key)
}

func (c *OrgCache) Exists(key string) bool {
	_, exists := c.cache.Get(key)
	return exists
}

func (c *OrgCache) Set(key string, value interface{}) {
	c.cache.Set(key, value, -1)
}

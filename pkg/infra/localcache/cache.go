package localcache

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// CacheService cache any object in memory on the local instance.
type CacheService struct {
	*gocache.Cache
}

// New returns a new CacheService
func New(defaultExpiration, cleanupInterval time.Duration) *CacheService {
	return &CacheService{
		Cache: gocache.New(defaultExpiration, cleanupInterval),
	}
}

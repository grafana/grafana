package localcache

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// CacheService cache any object in memory on the local instance.
type CacheService struct {
	*gocache.Cache
}

func ProvideService() *CacheService {
	return New(5*time.Minute, 10*time.Minute)
}

// New returns a new CacheService
func New(defaultExpiration, cleanupInterval time.Duration) *CacheService {
	return &CacheService{
		Cache: gocache.New(defaultExpiration, cleanupInterval),
	}
}

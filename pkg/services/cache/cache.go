package cache

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

type CacheService struct {
	*gocache.Cache
}

func New(defaultExpiration, cleanupInterval time.Duration) *CacheService {
	return &CacheService{
		Cache: gocache.New(defaultExpiration, cleanupInterval),
	}
}

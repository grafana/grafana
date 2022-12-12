package api

import (
	"context"
	"time"
)

func (hs *HTTPServer) databaseHealthy(ctx context.Context) bool {
	const cacheKey = "db-healthy"

	if cached, found := hs.CacheService.Get(cacheKey); found {
		return cached.(bool)
	}

	_, err := hs.SQLStore.GetSqlxSession().Exec(ctx, "SELECT 1")
	healthy := err == nil

	hs.CacheService.Set(cacheKey, healthy, time.Second*5)
	return healthy
}

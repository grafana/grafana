package api

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) databaseHealthy(ctx context.Context) bool {
	const cacheKey = "db-healthy"

	if cached, found := hs.CacheService.Get(cacheKey); found {
		return cached.(bool)
	}

	healthy := hs.SQLStore.GetDBHealthQuery(ctx, &models.GetDBHealthQuery{}) == nil

	hs.CacheService.Set(cacheKey, healthy, time.Second*5)
	return healthy
}

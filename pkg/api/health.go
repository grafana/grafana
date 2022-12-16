package api

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func (hs *HTTPServer) databaseHealthy(ctx context.Context) bool {
	const cacheKey = "db-healthy"

	if cached, found := hs.CacheService.Get(cacheKey); found {
		return cached.(bool)
	}

	err := hs.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Exec("SELECT 1")
		return err
	})
	healthy := err == nil

	hs.CacheService.Set(cacheKey, healthy, time.Second*5)
	return healthy
}

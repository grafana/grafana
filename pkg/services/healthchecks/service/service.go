package service

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/healthchecks"
	"time"
)

type HealthChecksServiceImpl struct {
	Store        healthchecks.Store
	CacheService *localcache.CacheService
}

func ProvideService(store healthchecks.Store, cache *localcache.CacheService) *HealthChecksServiceImpl {
	service := &HealthChecksServiceImpl{
		Store:        store,
		CacheService: cache,
	}

	return service
}

func (hcs *HealthChecksServiceImpl) CheckDatabaseHealth(ctx context.Context) error {
	const cacheKey = "db-healthy"

	if cached, found := hcs.CacheService.Get(cacheKey); found {
		return nil
		//return cached.(bool)
	}

	if err := hcs.Store.CheckDatabaseHealth(ctx); err != nil {
		return err
	}

	//err := hs.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
	//	_, err := session.Exec("SELECT 1")
	//	return err
	//})

	hcs.CacheService.Set(cacheKey, true, time.Second*5)

	return nil
}

func (hcs *HealthChecksServiceImpl) CheckDatabaseMigrations(ctx context.Context) bool {
	//TODO
}

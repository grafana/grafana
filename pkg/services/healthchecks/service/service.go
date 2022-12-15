package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/healthchecks"
)

// These are required checks for the server to start up. If you add a core check, but fail to register it at startup, the server will not start.
var coreChecks = []string{
	"migrations",
}

type HealthChecksServiceImpl struct {
	// Store            healthchecks.Store
	CacheService     *localcache.CacheService
	registeredChecks map[string]healthchecks.HealthChecker
	coreChecks       map[string]healthchecks.HealthChecker
}

// func ProvideService(store healthchecks.Store, cache *localcache.CacheService) *HealthChecksServiceImpl {
// 	service := &HealthChecksServiceImpl{
// 		Store:            store,
// 		CacheService:     cache,
// 		registeredChecks: map[string]healthchecks.HealthChecker{},
// 	}

// 	return service
// }

func ProvideService(cache *localcache.CacheService) *HealthChecksServiceImpl {
	service := &HealthChecksServiceImpl{

		CacheService:     cache,
		registeredChecks: map[string]healthchecks.HealthChecker{},
		coreChecks:       map[string]healthchecks.HealthChecker{},
	}

	return service
}

// Make sure there is a registered handler for all core checks
func (hcs *HealthChecksServiceImpl) AreCoreChecksImplemented(ctx context.Context) bool {
	for _, c := range coreChecks {
		if _, ok := hcs.coreChecks[c]; !ok {
			return false
		}
	}
	return true
}

func (hcs *HealthChecksServiceImpl) RegisterHealthCheck(ctx context.Context, name string, checker healthchecks.HealthChecker) error {
	for _, c := range coreChecks {
		if c == name {
			hcs.coreChecks[name] = checker
			return nil
		}
	}
	hcs.registeredChecks[name] = checker
	return nil
}

func (hcs *HealthChecksServiceImpl) GetHealthCheck(ctx context.Context, name string) healthchecks.HealthCheckStatus {
	//TODO
	/*
			- look up the result in the cache
		    - if its there return it
		    - if its not, run the health check and cache result and return result
	*/
	return 1
}

func (hcs *HealthChecksServiceImpl) CheckDatabaseHealth(ctx context.Context) error {
	// const cacheKey = "db-healthy"

	// if cached, found := hcs.CacheService.Get(cacheKey); found {
	// 	return nil
	// 	//return cached.(bool)
	// }

	// if err := hcs.Store.CheckDatabaseHealth(ctx); err != nil {
	// 	return err
	// }

	// //err := hs.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
	// //	_, err := session.Exec("SELECT 1")
	// //	return err
	// //})

	// hcs.CacheService.Set(cacheKey, true, time.Second*5)

	return nil
}

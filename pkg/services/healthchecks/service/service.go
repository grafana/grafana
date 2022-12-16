package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/healthchecks"
	"github.com/grafana/grafana/pkg/services/healthchecks/models"
)

// These are required checks for the server to start up. If you add a core check, but fail to register it at startup, the server will not start.
var coreChecks = []string{
	"migrations",
}

type HealthChecksServiceImpl struct {
	CacheService     *localcache.CacheService
	registeredChecks map[string]models.HealthCheck
}

func ProvideService(cache *localcache.CacheService) *HealthChecksServiceImpl {
	service := &HealthChecksServiceImpl{

		CacheService:     cache,
		registeredChecks: map[string]models.HealthCheck{},
	}

	return service
}

// Make sure there is a registered handler for all core checks
func (hcs *HealthChecksServiceImpl) areCoreChecksImplemented(ctx context.Context) bool {
	for _, c := range coreChecks {
		if _, ok := hcs.registeredChecks[c]; !ok {
			return false
		}
	}
	return true
}

func (hcs *HealthChecksServiceImpl) RunCoreHealthChecks(ctx context.Context) error {
	if !hcs.areCoreChecksImplemented(ctx) {
		return errors.New("core health checks not registered yet")
	}

	// Run all the core health checks. Return error if any fail.
	for _, coreCheck := range coreChecks {
		status, _, err := hcs.registeredChecks[coreCheck].HealthCheckFunc(coreCheck)
		if err != nil || status != models.StatusGreen {
			return fmt.Errorf("core check %s failed", coreCheck)
		}
	}

	return nil
}

func (hcs *HealthChecksServiceImpl) RegisterHealthCheck(ctx context.Context, config models.HealthCheckConfig, checker healthchecks.HealthChecker) error {
	healthCheck := models.HealthCheck{
		HealthCheckConfig: config,
		HealthCheckFunc:   checker.CheckHealth,
	}
	if _, has := hcs.registeredChecks[config.Name]; has {
		return errors.New(fmt.Sprintf("health check %s already exists", config.Name))
	}
	hcs.registeredChecks[config.Name] = healthCheck
	return nil
}

func (hcs *HealthChecksServiceImpl) GetHealthCheck(ctx context.Context, name string) models.HealthCheck {
	//TODO
	/*
			- look up the result in the cache
		    - if its there return it
		    - if its not, run the health check and cache result and return result

			- return the external representation of a health check result
	*/
	return models.HealthCheck{}
}

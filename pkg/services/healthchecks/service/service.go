package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/healthchecks"
	"github.com/grafana/grafana/pkg/services/healthchecks/models"
	"github.com/robfig/cron/v3"
)

// These are required checks for the server to start up. If you add a core check, but fail to register it at startup, the server will not start.
var coreChecks = map[string]bool{
	"migrations": true,
}

type HealthChecksServiceImpl struct {
	mu               sync.Mutex
	cron             *cron.Cron
	registeredChecks map[string]models.HealthCheck
	log              *log.ConcreteLogger
}

func ProvideService() *HealthChecksServiceImpl {
	service := &HealthChecksServiceImpl{
		registeredChecks: map[string]models.HealthCheck{},
		cron:             cron.New(),
		log:              log.New("health-service"),
	}
	service.cron.Start()
	return service
}

// Make sure there is a registered handler for all core checks
func (hcs *HealthChecksServiceImpl) areCoreChecksImplemented(ctx context.Context) bool {
	for c := range coreChecks {
		if _, ok := hcs.registeredChecks[c]; !ok {
			return false
		}
	}
	return true
}

func (hcs *HealthChecksServiceImpl) RunCoreHealthChecks(ctx context.Context) error {
	hcs.mu.Lock()
	defer hcs.mu.Unlock()
	if !hcs.areCoreChecksImplemented(ctx) {
		return models.ErrCoreChecksNotRegistered
	}

	// Run all the core health checks. Return error if any fail.
	for coreCheck := range coreChecks {
		c := hcs.registeredChecks[coreCheck]
		status, metrics, err := c.HealthCheckFunc(coreCheck)
		if err != nil || status == models.StatusRed {
			return fmt.Errorf("core check %s failed", coreCheck)
		}

		c.LatestMetrics = metrics
		c.LatestStatus = status
		c.LatestUpdateTime = time.Now()
		hcs.registeredChecks[coreCheck] = c
	}

	return nil
}

func (hcs *HealthChecksServiceImpl) RegisterHealthCheck(ctx context.Context, config models.HealthCheckConfig, checker healthchecks.HealthChecker) error {
	hcs.mu.Lock()
	defer hcs.mu.Unlock()

	// valid name
	if config.Name == "" {
		return errors.New("received health check with empty name")
	}

	// unique names only
	if _, has := hcs.registeredChecks[config.Name]; has {
		return fmt.Errorf("health check %s already exists", config.Name)
	}

	// no readiness checks not listed as core
	if config.Type == models.ReadinessCheck && !coreChecks[config.Name] {
		return fmt.Errorf("health check '%s' has type 'readiness' but it is not listed as a core check", config.Name)
	}

	// no check names reserved by core checks
	if config.Type != models.ReadinessCheck && coreChecks[config.Name] {
		return fmt.Errorf("health check name '%s' is reserved for a readiness check", config.Name)
	}

	// valid intervals only
	if config.Strategy == models.StrategyChron && config.Interval <= 0 {
		return fmt.Errorf("health check '%s' has invalid interval of '%d'", config.Name, config.Interval)
	}

	healthCheck := models.HealthCheck{
		HealthCheckConfig: config,
		HealthCheckFunc:   checker.CheckHealth,
	}

	hcs.registeredChecks[config.Name] = healthCheck

	// if it's a readiness check, it will be run whenever the readiness endpoint is pinged
	if config.Type == models.ReadinessCheck {
		return nil
	}

	if config.Strategy == models.StrategyChron {
		// TODO should we run these immediately? Or after a delay?
		hcs.cron.Schedule(cron.ConstantDelaySchedule{
			Delay: config.Interval,
		}, cron.FuncJob(func() {
			hcs.runIndividualHealthCheck(healthCheck)
		}))
	} else if config.Strategy == models.StrategyOnce {
		hcs.runIndividualHealthCheck(healthCheck)
	}

	return nil
}

func (hcs *HealthChecksServiceImpl) GetLatestHealth(ctx context.Context) (models.HealthStatus, map[string]map[string]string) {
	allMetrics := make(map[string]map[string]string)
	hasYellow := false
	hasRed := false

	// do not wait for lock, just read current state of health check map
	for _, c := range hcs.registeredChecks {
		if c.LatestStatus == models.StatusRed {
			hasRed = true
		} else if c.LatestStatus == models.StatusYellow {
			hasYellow = true
		}
		metrics := c.LatestMetrics
		if metrics == nil {
			metrics = make(map[string]string)
		}
		metrics["latest_update_time"] = c.LatestUpdateTime.UTC().String()
		allMetrics[c.HealthCheckConfig.Name] = metrics
	}
	status := models.StatusGreen
	if hasRed {
		status = models.StatusRed
	} else if hasYellow {
		status = models.StatusYellow
	}
	return status, allMetrics
}

func (hcs *HealthChecksServiceImpl) GetHealthCheck(ctx context.Context, name string) (bool, models.HealthCheck) {
	hcs.mu.Lock()
	defer hcs.mu.Unlock()
	check, found := hcs.registeredChecks[name]
	return found, check
}

func (hcs *HealthChecksServiceImpl) ListHealthChecks(ctx context.Context) []models.HealthCheckConfig {
	configs := make([]models.HealthCheckConfig, 0)
	for _, c := range hcs.registeredChecks {
		configs = append(configs, c.HealthCheckConfig)
	}
	return configs
}

func (hcs *HealthChecksServiceImpl) runIndividualHealthCheck(hc models.HealthCheck) {
	hcs.mu.Lock()
	defer hcs.mu.Unlock()
	hcs.log.Info("Running health check", "name", hc.HealthCheckConfig.Name)

	status, metrics, err := hc.HealthCheckFunc(hc.HealthCheckConfig.Name)
	if err != nil {
		hcs.log.Error("Error running health check", "name", hc.HealthCheckConfig.Name, "error", err.Error())
	}
	check := hcs.registeredChecks[hc.HealthCheckConfig.Name]
	check.LatestMetrics = metrics
	check.LatestStatus = status
	check.LatestUpdateTime = time.Now()
	hcs.registeredChecks[hc.HealthCheckConfig.Name] = check
}

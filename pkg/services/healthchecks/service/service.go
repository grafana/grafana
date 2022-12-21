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

	// Run all the core health checks. Return error if any fail or are red. Return not ready if any are yellow.
	for coreCheck := range coreChecks {
		c := hcs.registeredChecks[coreCheck]
		// if readiness check already ran and is green, continue
		if !c.LatestUpdateTime.IsZero() && c.LatestStatus == models.StatusGreen {
			continue
		}
		status, metrics, err := c.HealthCheckFunc(ctx, coreCheck)
		c.LatestMetrics = metrics
		c.LatestStatus = status
		c.LatestUpdateTime = time.Now()
		hcs.registeredChecks[coreCheck] = c

		if err != nil || status == models.StatusRed {
			return fmt.Errorf("core check %s failed", coreCheck)
		} else if status == models.StatusYellow {
			return models.ErrCoreChecksNotFinished
		}
	}

	return nil
}

// RegisterHealthCheck validates a health check config and adds it to the list of registered health checks.
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
	if config.Strategy == models.StrategyCron && config.Interval <= 0 {
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

	if config.Strategy == models.StrategyCron {
		startFunc := func() {
			// run initially, then schedule follow-up jobs
			hcs.runIndividualHealthCheck(ctx, healthCheck)

			hcs.cron.Schedule(cron.ConstantDelaySchedule{
				Delay: config.Interval,
			}, cron.FuncJob(func() {
				hcs.runIndividualHealthCheck(ctx, healthCheck)
			}))
		}

		if config.InitialDelay > 0 {
			time.AfterFunc(config.InitialDelay, startFunc)
		} else {
			startFunc()
		}
	} else if config.Strategy == models.StrategyOnce {
		if config.InitialDelay > 0 {
			time.AfterFunc(config.InitialDelay, func() {
				hcs.runIndividualHealthCheck(ctx, healthCheck)
			})
		} else {
			hcs.runIndividualHealthCheck(ctx, healthCheck)
		}
	}

	return nil
}

func (hcs *HealthChecksServiceImpl) RunOnDemandHealthCheck(ctx context.Context, name string) error {
	hcs.mu.Lock()
	defer hcs.mu.Unlock()

	check, has := hcs.registeredChecks[name]
	if !has {
		return fmt.Errorf("received on-demand health check request for unregistered name %s", name)
	}

	if check.HealthCheckConfig.Strategy != models.StrategyOnDemand {
		return fmt.Errorf("health check %s does not use the on-demand strategy", name)
	}

	hcs.runIndividualHealthCheck(ctx, check)
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
		if !c.LatestUpdateTime.IsZero() {
			metrics["latest_update_time"] = c.LatestUpdateTime.UTC().String()
		}
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

func (hcs *HealthChecksServiceImpl) runIndividualHealthCheck(ctx context.Context, hc models.HealthCheck) {
	// avoid deadlocking and service disruptions
	go func() {
		hcs.mu.Lock()
		defer hcs.mu.Unlock()
		hcs.log.Debug("Running health check", "name", hc.HealthCheckConfig.Name)

		status, metrics, err := hc.HealthCheckFunc(ctx, hc.HealthCheckConfig.Name)
		if err != nil {
			hcs.log.Error("Error running health check", "name", hc.HealthCheckConfig.Name, "error", err.Error())
			metrics["error_string"] = err.Error()
		}
		check := hcs.registeredChecks[hc.HealthCheckConfig.Name]
		check.LatestMetrics = metrics
		check.LatestStatus = status
		check.LatestUpdateTime = time.Now()
		hcs.registeredChecks[hc.HealthCheckConfig.Name] = check
	}()
}

package healthchecks

import (
	"context"

	"github.com/grafana/grafana/pkg/services/healthchecks/models"
)

type Service interface {
	RegisterHealthCheck(ctx context.Context, config models.HealthCheckConfig, checker HealthChecker) error
	RunCoreHealthChecks(ctx context.Context) error
	GetHealthCheck(ctx context.Context, name string) models.HealthCheck
}

type HealthChecker interface {
	CheckHealth(name string) (models.HealthStatus, map[string]string, error)
}

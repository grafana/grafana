package healthchecks

import (
	"context"

	"github.com/grafana/grafana/pkg/services/healthchecks/models"
)

//go:generate mockery --name Service --structname MockHealthService --inpackage --filename health_service_mock.go
type Service interface {
	RegisterHealthCheck(ctx context.Context, config models.HealthCheckConfig, checker HealthChecker) error
	RunCoreHealthChecks(ctx context.Context) error
	RunOnDemandHealthCheck(ctx context.Context, name string) error
	GetLatestHealth(ctx context.Context) (models.HealthStatus, map[string]map[string]string)
	GetHealthCheck(ctx context.Context, name string) (bool, models.HealthCheck)
	ListHealthChecks(ctx context.Context) []models.HealthCheckConfig
}

type HealthChecker interface {
	CheckHealth(ctx context.Context, name string) (models.HealthStatus, map[string]string, error)
}

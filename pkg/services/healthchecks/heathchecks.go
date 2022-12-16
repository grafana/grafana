package healthchecks

import (
	"context"

	"github.com/grafana/grafana/pkg/services/healthchecks/models"
)

type Service interface {
	RegisterHealthCheck(ctx context.Context, name string, checker HealthChecker) error
	AreCoreChecksImplemented(ctx context.Context) bool
	GetHealthCheck(ctx context.Context, name string) models.HealthStatus
}

type HealthChecker interface {
	CheckHealth(name string) (models.HealthStatus, map[string]string, error)
}

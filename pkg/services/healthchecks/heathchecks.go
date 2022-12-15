package healthchecks

import "context"

type Service interface {
	RegisterHealthCheck(ctx context.Context, name string, checker HealthChecker) error
	AreCoreChecksImplemented(ctx context.Context) bool

	// CheckDatabaseHealth(ctx context.Context) error
	// CheckDatabaseMigrations(ctx context.Context) error // TODO
}

type HealthCheckStatus int

const (
	StatusOK  HealthCheckStatus = 0
	StatusBad HealthCheckStatus = 1
)

type HealthChecker interface {
	CheckHealth(name string) (int, error)
}

// type Store interface {
// 	CheckDatabaseHealth(ctx context.Context) error
// 	CheckDatabaseMigrations(ctx context.Context) error // TODO
// }

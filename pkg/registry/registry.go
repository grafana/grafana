package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// BackgroundServiceRegistry provides background services.
type BackgroundServiceRegistry interface {
	GetServices() []BackgroundService
}

// CanBeDisabled allows the services to decide if it should
// be started or not by itself. This is useful for services
// that might not always be started, ex alerting.
// This will be called after `Init()`.
type CanBeDisabled interface {
	// IsDisabled should return a bool saying if it can be started or not.
	IsDisabled() bool
}

// BackgroundService should be implemented for services that have
// long running tasks in the background.
type BackgroundService interface {
	// Run starts the background process of the service after `Init` have been called
	// on all services. The `context.Context` passed into the function should be used
	// to subscribe to ctx.Done() so the service can be notified when Grafana shuts down.
	Run(ctx context.Context) error
}

// UsageStatsProvidersRegistry provides services sharing their usage stats
type UsageStatsProvidersRegistry interface {
	GetServices() []ProvidesUsageStats
}

// ProvidesUsageStats is an interface for services that share their usage stats
type ProvidesUsageStats interface {
	// GetUsageStats is called on a schedule by the UsageStatsService
	// Any errors occurring during usage stats collection should be collected and logged within the provider.
	GetUsageStats(ctx context.Context) map[string]interface{}
}

// DatabaseMigrator allows the caller to add migrations to
// the migrator passed as argument
type DatabaseMigrator interface {
	// AddMigrations allows the service to add migrations to
	// the database migrator.
	AddMigration(mg *migrator.Migrator)
}

// IsDisabled returns whether a background service is disabled.
func IsDisabled(srv BackgroundService) bool {
	canBeDisabled, ok := srv.(CanBeDisabled)
	return ok && canBeDisabled.IsDisabled()
}

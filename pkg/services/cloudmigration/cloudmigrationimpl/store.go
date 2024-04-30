package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigration(ctx context.Context, token cloudmigration.CloudMigration) (*cloudmigration.CloudMigration, error)
	GetMigrationByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigration, error)
	GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error)
	DeleteMigration(ctx context.Context, uid string) (*cloudmigration.CloudMigration, error)

	CreateMigrationRun(ctx context.Context, cmr cloudmigration.CloudMigrationRun) (string, error)
	GetMigrationStatus(ctx context.Context, cmrUID string) (*cloudmigration.CloudMigrationRun, error)
	GetMigrationStatusList(ctx context.Context, migrationUID string) ([]*cloudmigration.CloudMigrationRun, error)
}

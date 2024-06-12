package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigration(ctx context.Context, token cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error)
	GetMigrationByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error)
	GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigrationSession, error)
	DeleteMigration(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error)

	CreateMigrationRun(ctx context.Context, cmr cloudmigration.Snapshot) (string, error)
	GetMigrationStatus(ctx context.Context, cmrUID string) (*cloudmigration.Snapshot, error)
	GetMigrationStatusList(ctx context.Context, migrationUID string) ([]*cloudmigration.Snapshot, error)
}

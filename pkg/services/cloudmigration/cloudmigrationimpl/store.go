package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigration(ctx context.Context, token cloudmigration.CloudMigration) error
	GetMigration(context.Context, int64) (*cloudmigration.CloudMigration, error)
	GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error)
	DeleteMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error)

	SaveMigrationRun(context.Context, *cloudmigration.CloudMigrationRun) error
}

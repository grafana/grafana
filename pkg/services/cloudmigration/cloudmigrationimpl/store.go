package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	GetMigration(context.Context, int64) (*cloudmigration.CloudMigration, error)
	SaveMigrationRun(context.Context, *cloudmigration.CloudMigrationRun) error
	CreateMigration(ctx context.Context, token cloudmigration.CloudMigration) error
	GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error)
}

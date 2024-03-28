package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	MigrateDatasources(context.Context, *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error)

	GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error)

	GetAllCloudMigrationRuns(ctx context.Context) ([]*cloudmigration.CloudMigrationRun, error)
	SaveCloudMigrationRun(ctx context.Context, run *cloudmigration.CloudMigrationRun) (*cloudmigration.CloudMigrationRun, error)
}

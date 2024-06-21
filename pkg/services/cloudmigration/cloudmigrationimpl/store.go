package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigrationSession(ctx context.Context, session cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error)
	GetMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error)
	GetAllCloudMigrationSessions(ctx context.Context) ([]*cloudmigration.CloudMigrationSession, error)
	DeleteMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error)

	CreateMigrationRun(ctx context.Context, cmr cloudmigration.CloudMigrationSnapshot) (string, error)
	GetMigrationStatus(ctx context.Context, cmrUID string) (*cloudmigration.CloudMigrationSnapshot, error)
	GetMigrationStatusList(ctx context.Context, migrationUID string) ([]*cloudmigration.CloudMigrationSnapshot, error)

	CreateSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) (string, error)
	UpdateSnapshot(ctx context.Context, snapshot cloudmigration.UpdateSnapshotCmd) error
	GetSnapshotByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSnapshot, error)
	GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error)

	CreateSnapshotResources(ctx context.Context, snapshotUid string, resources []cloudmigration.MigrationResource) error
	GetSnapshotResources(ctx context.Context, snapshotUid string, offset int, limit int) ([]cloudmigration.MigrationResource, error)
	UpdateSnapshotResources(ctx context.Context, snapshotUid string, resources []cloudmigration.MigrationResource) error
	DeleteSnapshotResources(ctx context.Context, snapshotUid string) error
}

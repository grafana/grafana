package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigrationSession(ctx context.Context, session cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error)
	GetMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error)
	GetCloudMigrationSessionList(ctx context.Context) ([]*cloudmigration.CloudMigrationSession, error)
	// DeleteMigrationSessionByUID deletes the migration session, and all the related snapshot and resources.
	// the work is done in a transaction.
	DeleteMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, []cloudmigration.CloudMigrationSnapshot, error)

	CreateSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) (string, error)
	UpdateSnapshot(ctx context.Context, snapshot cloudmigration.UpdateSnapshotCmd) error
	GetSnapshotByUID(ctx context.Context, sessUid, id string, resultPage int, resultLimit int) (*cloudmigration.CloudMigrationSnapshot, error)
	GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error)
	DeleteSnapshot(ctx context.Context, snapshotUid string) error

	CreateUpdateSnapshotResources(ctx context.Context, snapshotUid string, resources []cloudmigration.CloudMigrationResource) error
	GetSnapshotResources(ctx context.Context, snapshotUid string, page int, limit int) ([]cloudmigration.CloudMigrationResource, error)
	GetSnapshotResourceStats(ctx context.Context, snapshotUid string) (*cloudmigration.SnapshotResourceStats, error)
	DeleteSnapshotResources(ctx context.Context, snapshotUid string) error
}

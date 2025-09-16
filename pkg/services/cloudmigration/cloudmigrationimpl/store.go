package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	CreateMigrationSession(ctx context.Context, session cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error)
	GetMigrationSessionByUID(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, error)
	GetCloudMigrationSessionList(ctx context.Context, orgID int64) ([]*cloudmigration.CloudMigrationSession, error)
	DeleteMigrationSessionByUID(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, []cloudmigration.CloudMigrationSnapshot, error)

	CreateSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) error
	UpdateSnapshot(ctx context.Context, snapshot cloudmigration.UpdateSnapshotCmd) error
	GetIndex(ctx context.Context, orgID int64, sessionUID string, snapshotUID string) (cloudmigration.CloudMigrationSnapshotIndex, error)
	GetPartition(ctx context.Context, snapshotUID string, resourceType string, partitionNumber int) (cloudmigration.CloudMigrationSnapshotPartition, error)
	StorePartition(ctx context.Context, snapshotUID string, resourceType string, partitionNumber int, data []byte) error
	GetSnapshotByUID(ctx context.Context, orgID int64, sessUid, id string, params cloudmigration.SnapshotResultQueryParams) (*cloudmigration.CloudMigrationSnapshot, error)
	GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error)
}

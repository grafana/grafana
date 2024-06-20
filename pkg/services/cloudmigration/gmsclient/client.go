package gmsclient

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type Client interface {
	ValidateKey(context.Context, cloudmigration.CloudMigrationSession) error
	MigrateData(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.MigrateDataRequest) (*cloudmigration.MigrateDataResponse, error)
	InitializeSnapshot(context.Context, cloudmigration.CloudMigrationSession) (*cloudmigration.InitializeSnapshotResponse, error)
	GetSnapshotStatus(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error)
}

const logPrefix = "cloudmigration.gmsclient"

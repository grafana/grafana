package cmsclient

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type Client interface {
	ValidateKey(context.Context, cloudmigration.CloudMigrationSession) error
	MigrateData(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.MigrateDataRequestDTO) (*cloudmigration.MigrateSnapshotResponseDTO, error)
}

const logPrefix = "cloudmigration.cmsclient"

var ErrMigrationNotDeleted = errutil.Internal("cloudmigrations.developerModeEnabled", errutil.WithPublicMessage("Developer mode enabled"))

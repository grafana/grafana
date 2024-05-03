package cmsclient

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type Client interface {
	ValidateKey(context.Context, cloudmigration.CloudMigration) error
	MigrateData(context.Context, cloudmigration.CloudMigration, cloudmigration.MigrateDataRequestDTO) (*cloudmigration.MigrateDataResponseDTO, error)
}

const logPrefix = "cloudmigration.cmsclient"

var ErrMigrationNotDeleted = errutil.Internal("cloudmigrations.developerModeEnabled", errutil.WithPublicMessage("Developer mode enabled"))

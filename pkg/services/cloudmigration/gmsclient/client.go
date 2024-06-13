package gmsclient

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type Client interface {
	ValidateKey(context.Context, cloudmigration.CloudMigrationSession) error
	MigrateData(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.MigrateDataRequest) (*cloudmigration.MigrateDataResponse, error)
}

const logPrefix = "cloudmigration.gmsclient"

var ErrMigrationNotDeleted = errutil.Internal("cloudmigrations.developerModeEnabled", errutil.WithPublicMessage("Developer mode enabled"))

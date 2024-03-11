package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type store interface {
	MigrateDatasources(context.Context, *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error)
}

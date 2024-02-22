package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) MigrateDatasources(ctx context.Context, request *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error) {
	return nil, cloudmigration.ErrInternalNotImplementedError
}

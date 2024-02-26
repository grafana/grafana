package cloudmigrationtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type Service struct {
	ExpectedError error
}

func (s *Service) MigrateDatasources(ctx context.Context, request *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error) {
	return nil, cloudmigration.ErrInternalNotImplementedError
}

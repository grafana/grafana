package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// CloudMigrationsServiceImpl Define the Service Implementation.
type NoopServiceImpl struct{}

var _ cloudmigration.Service = (*NoopServiceImpl)(nil)

func (s *NoopServiceImpl) MigrateDatasources(ctx context.Context, request *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateToken(ctx context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	return cloudmigration.CreateAccessTokenResponse{}, cloudmigration.ErrFeatureDisabledError
}
func (s *NoopServiceImpl) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigration) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigrationList(ctx context.Context) (*cloudmigration.CloudMigrationListResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateMigration(ctx context.Context, cm cloudmigration.CloudMigrationRequestBody) (*cloudmigration.CloudMigrationResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) UpdateMigration(ctx context.Context, id int64, cm cloudmigration.CloudMigrationRequestBody) (*cloudmigration.CloudMigrationResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigrationStatus(ctx context.Context, id string, runID string) (*cloudmigration.CloudMigrationRun, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigrationStatusList(ctx context.Context, id string) ([]*cloudmigration.CloudMigrationRun, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) DeleteMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) SaveMigrationRun(ctx context.Context, cmr *cloudmigration.CloudMigrationRun) (string, error) {
	return "", cloudmigration.ErrInternalNotImplementedError
}

func (s *NoopServiceImpl) GetMigrationDataJSON(ctx context.Context, id int64) ([]byte, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) ParseCloudMigrationConfig() (string, error) {
	return "", cloudmigration.ErrFeatureDisabledError
}

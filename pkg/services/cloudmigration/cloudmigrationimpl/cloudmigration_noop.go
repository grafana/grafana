package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/gcom"
)

// noopServiceImpl Define the Service Implementation.
type noopServiceImpl struct{}

var _ cloudmigration.Service = (*noopServiceImpl)(nil)

func (s *noopServiceImpl) GetToken(ctx context.Context) (gcom.TokenView, error) {
	return gcom.TokenView{}, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) CreateToken(ctx context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	return cloudmigration.CreateAccessTokenResponse{}, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) DeleteToken(ctx context.Context, uid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) GetSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) GetSessionList(ctx context.Context) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) CreateSession(ctx context.Context, cm cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) GetMigrationStatus(ctx context.Context, runUID string) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) GetMigrationRunList(ctx context.Context, uid string) (*cloudmigration.SnapshotList, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) DeleteSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *noopServiceImpl) CreateMigrationRun(context.Context, cloudmigration.CloudMigrationSnapshot) (string, error) {
	return "", cloudmigration.ErrInternalNotImplementedError
}

func (s *noopServiceImpl) RunMigration(context.Context, string) (*cloudmigration.MigrateDataResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

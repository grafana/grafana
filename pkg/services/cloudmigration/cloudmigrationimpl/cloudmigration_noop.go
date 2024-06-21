package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/gcom"
)

// NoopServiceImpl Define the Service Implementation.
type NoopServiceImpl struct{}

var _ cloudmigration.Service = (*NoopServiceImpl)(nil)

func (s *NoopServiceImpl) GetToken(ctx context.Context) (gcom.TokenView, error) {
	return gcom.TokenView{}, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateToken(ctx context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	return cloudmigration.CreateAccessTokenResponse{}, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) DeleteToken(ctx context.Context, uid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSessionList(ctx context.Context) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateSession(ctx context.Context, cm cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigrationStatus(ctx context.Context, runUID string) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetMigrationRunList(ctx context.Context, uid string) (*cloudmigration.CloudMigrationRunList, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) DeleteSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateMigrationRun(context.Context, cloudmigration.CloudMigrationSnapshot) (string, error) {
	return "", cloudmigration.ErrInternalNotImplementedError
}

func (s *NoopServiceImpl) RunMigration(context.Context, string) (*cloudmigration.MigrateDataResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateSnapshot(ctx context.Context, sessionUid string) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSnapshot(ctx context.Context, query cloudmigration.GetSnapshotsQuery) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) UploadSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

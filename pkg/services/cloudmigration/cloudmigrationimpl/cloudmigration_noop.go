package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authapi"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/user"
)

// NoopServiceImpl Define the Service Implementation.
type NoopServiceImpl struct{}

var _ cloudmigration.Service = (*NoopServiceImpl)(nil)

func (s *NoopServiceImpl) GetToken(ctx context.Context) (authapi.TokenView, error) {
	return authapi.TokenView{}, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateToken(ctx context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	return cloudmigration.CreateAccessTokenResponse{}, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) DeleteToken(ctx context.Context, uid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	return cloudmigration.ErrMigrationDisabled
}

func (s *NoopServiceImpl) GetSession(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSessionList(ctx context.Context, orgID int64) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateSession(ctx context.Context, signedInUser *user.SignedInUser, cm cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	return nil, cloudmigration.ErrMigrationDisabled
}

func (s *NoopServiceImpl) DeleteSession(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, uid string) (*cloudmigration.CloudMigrationSession, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CreateSnapshot(ctx context.Context, user *user.SignedInUser, cmd cloudmigration.CreateSnapshotCommand) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSnapshot(ctx context.Context, query cloudmigration.GetSnapshotsQuery) (*cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	return nil, cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) UploadSnapshot(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, sessionUid string, snapshotUid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

func (s *NoopServiceImpl) CancelSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error {
	return cloudmigration.ErrFeatureDisabledError
}

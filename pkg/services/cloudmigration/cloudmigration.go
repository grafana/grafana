package cloudmigration

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authapi"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	ResourceStorageTypeFs = "fs"
	ResourceStorageTypeDb = "db"
)

type Service interface {
	// GetToken Returns the cloud migration token if it exists.
	GetToken(ctx context.Context) (authapi.TokenView, error)
	// CreateToken Creates a cloud migration token.
	CreateToken(ctx context.Context) (CreateAccessTokenResponse, error)
	// ValidateToken Sends a request to GMS to test the token.
	ValidateToken(ctx context.Context, mig CloudMigrationSession) error
	DeleteToken(ctx context.Context, uid string) error

	CreateSession(ctx context.Context, signedInUser *user.SignedInUser, req CloudMigrationSessionRequest) (*CloudMigrationSessionResponse, error)
	GetSession(ctx context.Context, orgID int64, migUID string) (*CloudMigrationSession, error)
	DeleteSession(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, migUID string) (*CloudMigrationSession, error)
	GetSessionList(ctx context.Context, orgID int64) (*CloudMigrationSessionListResponse, error)

	CreateSnapshot(ctx context.Context, signedInUser *user.SignedInUser, cmd CreateSnapshotCommand) (*CloudMigrationSnapshot, error)
	GetSnapshot(ctx context.Context, query GetSnapshotsQuery) (*CloudMigrationSnapshot, error)
	GetSnapshotList(ctx context.Context, query ListSnapshotsQuery) ([]CloudMigrationSnapshot, error)
	UploadSnapshot(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, sessionUid string, snapshotUid string) error
	CancelSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error
}

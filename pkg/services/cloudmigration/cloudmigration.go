package cloudmigration

import (
	"context"

	"github.com/grafana/grafana/pkg/services/gcom"
)

type Service interface {
	// GetToken Returns the cloud migration token if it exists.
	GetToken(ctx context.Context) (gcom.TokenView, error)
	// CreateToken Creates a cloud migration token.
	CreateToken(ctx context.Context) (CreateAccessTokenResponse, error)
	// ValidateToken Sends a request to CMS to test the token.
	ValidateToken(ctx context.Context, mig CloudMigration) error
	DeleteToken(ctx context.Context, uid string) error

	CreateMigration(ctx context.Context, req CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigration(ctx context.Context, migUID string) (*CloudMigration, error)
	DeleteMigration(ctx context.Context, migUID string) (*CloudMigration, error)
	UpdateMigration(ctx context.Context, migUID string, request CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigrationList(context.Context) (*CloudMigrationListResponse, error)

	RunMigration(ctx context.Context, migUID string) (*MigrateDataResponseDTO, error)
	GetMigrationStatus(ctx context.Context, runUID string) (*CloudMigrationRun, error)
	GetMigrationRunList(ctx context.Context, migUID string) (*CloudMigrationRunList, error)
}

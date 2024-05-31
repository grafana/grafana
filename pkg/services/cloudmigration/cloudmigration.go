package cloudmigration

import (
	"context"

	"github.com/grafana/grafana/pkg/services/gcom"
)

type Service interface {
	// Returns the cloud migration token if it exists.
	GetToken(context.Context) (gcom.TokenView, error)
	// Creates a cloud migration token.
	CreateToken(context.Context) (CreateAccessTokenResponse, error)
	// Sends a request to CMS to test the token.
	ValidateToken(context.Context, CloudMigration) error
	DeleteToken(ctx context.Context, uid string) error

	CreateMigration(context.Context, CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigration(ctx context.Context, uid string) (*CloudMigration, error)
	DeleteMigration(ctx context.Context, uid string) (*CloudMigration, error)
	UpdateMigration(ctx context.Context, uid string, request CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigrationList(context.Context) (*CloudMigrationListResponse, error)

	RunMigration(ctx context.Context, uid string) (*MigrateDataResponseDTO, error)
	CreateMigrationRun(context.Context, CloudMigrationRun) (string, error)
	GetMigrationStatus(ctx context.Context, runUID string) (*CloudMigrationRun, error)
	GetMigrationRunList(context.Context, string) (*CloudMigrationRunList, error)
}

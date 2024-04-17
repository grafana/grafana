package cloudmigration

import (
	"context"
)

type Service interface {
	// tokens
	CreateToken(context.Context) (CreateAccessTokenResponse, error)
	ValidateToken(context.Context, CloudMigration) error
	// migration management
	CreateMigration(context.Context, CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigration(context.Context, int64) (*CloudMigration, error)
	DeleteMigration(context.Context, int64) (*CloudMigration, error)
	UpdateMigration(context.Context, int64, CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigrationList(context.Context) (*CloudMigrationListResponse, error)
	// migration run management
	RunMigration(context.Context, int64) (*MigrateDataResponseDTO, error)
	SaveMigrationRun(context.Context, *CloudMigrationRun) (int64, error)
	GetMigrationStatus(context.Context, string, string) (*CloudMigrationRun, error)
	GetMigrationStatusList(context.Context, string) ([]*CloudMigrationRun, error)
}

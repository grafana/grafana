package cloudmigration

import (
	"context"
)

type Service interface {
	CreateToken(context.Context) (CreateAccessTokenResponse, error)
	ValidateToken(context.Context, CloudMigration) error

	CreateMigration(context.Context, CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigration(context.Context, int64) (*CloudMigration, error)
	DeleteMigration(context.Context, int64) (*CloudMigration, error)
	UpdateMigration(context.Context, int64, CloudMigrationRequest) (*CloudMigrationResponse, error)
	GetMigrationList(context.Context) (*CloudMigrationListResponse, error)

	RunMigration(context.Context, int64) (*MigrateDataResponseDTO, error)
	SaveMigrationRun(context.Context, *CloudMigrationRun) (int64, error)
	GetMigrationStatus(context.Context, string, string) (*CloudMigrationRun, error)
	GetMigrationRunList(context.Context, string) (*CloudMigrationRunList, error)
}

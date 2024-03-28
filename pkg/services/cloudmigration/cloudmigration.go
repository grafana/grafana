package cloudmigration

import (
	"context"
)

type Service interface {
	CreateToken(context.Context) (CreateAccessTokenResponse, error)
	ValidateToken(context.Context, string) error
	SaveEncryptedToken(context.Context, string) error
	// migration
	GetMigration(context.Context, int64) (*CloudMigration, error)
	GetMigrationList(context.Context) ([]CloudMigrationResponse, error)
	CreateMigration(context.Context, CloudMigrationRequest) (*CloudMigrationResponse, error)
	UpdateMigration(context.Context, int64, CloudMigrationRequest) (*CloudMigrationResponse, error)
	RunMigration(context.Context, int64) (*RunMigrationResponse, error)
	GetMigrationStatus(context.Context, string, string) (*CloudMigrationRun, error)
	GetMigrationStatusList(context.Context, string) ([]CloudMigrationRun, error)
	DeleteMigration(context.Context, string) error
	SaveMigrationRun(context.Context, *CloudMigrationRun) error
}

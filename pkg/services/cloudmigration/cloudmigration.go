package cloudmigration

import (
	"context"
)

// Service is the primary interface for th cloudmigration service
type Service interface {
	// Token
	CreateToken(context.Context) (CreateAccessTokenResponse, error)
	ValidateToken(context.Context, string) error
	SaveEncryptedToken(context.Context, string) error
	// Migration
	GetMigration(context.Context, int64) (*CloudMigrationResponse, error)
	GetMigrationList(context.Context) (*CloudMigrationListResponse, error)
	CreateMigration(context.Context, CloudMigrationRequest) (*CloudMigrationResponse, error)
	UpdateMigration(context.Context, int64, CloudMigrationRequest) (*CloudMigrationResponse, error)
	RunMigration(context.Context, string) (*CloudMigrationRun, error)
	DeleteMigration(context.Context, string) error
	// Migration Run
	GetMigrationRun(context.Context, string, string) (*CloudMigrationRun, error)
	GetMigrationRunList(context.Context, string) ([]CloudMigrationRun, error)
}

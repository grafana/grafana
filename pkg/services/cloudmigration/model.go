package cloudmigration

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented", errutil.WithPublicMessage("Internal server error"))
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance"))
)

type CloudMigration struct {
	ID        int64     `json:"id" xorm:"pk autoincr 'id'"`
	AuthToken string    `json:"authToken"`
	Stack     string    `json:"stack"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

type MigratedResourceResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type MigrationResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type MigratedResource struct {
	Type   string                 `json:"type"`
	ID     string                 `json:"id"`
	RefID  string                 `json:"refID"`
	Name   string                 `json:"name"`
	Result MigratedResourceResult `json:"result"`
}

// swagger:response cloudMigrationRunResponse
type CloudMigrationRun struct {
	ID                int64              `json:"id" xorm:"pk autoincr 'id'"`
	CloudMigrationUID string             `json:"uid" xorm:"cloud_migration_uid"`
	Resources         []MigratedResource `json:"items"`
	Result            MigrationResult    `json:"result"`
	Created           time.Time          `json:"created"`
	Updated           time.Time          `json:"updated"`
	Finished          time.Time          `json:"finished"`
}

// swagger:response cloudMigrationRunListResponse
type CloudMigrationRunList struct {
	Runs []CloudMigrationRun `json:"runs"`
}

// swagger:parameters createMigration
type CloudMigrationRequest struct {
	AuthToken string `json:"authToken"`
}

// swagger:response cloudMigrationResponse
type CloudMigrationResponse struct {
	ID      int64     `json:"id"`
	Stack   string    `json:"stack"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// swagger:response cloudMigrationListResponse
type CloudMigrationListResponse struct {
	Migrations []CloudMigrationResponse `json:"migrations"`
}

type MigrateDatasourcesRequest struct {
	MigrateToPDC       bool
	MigrateCredentials bool
}

type MigrateDatasourcesResponse struct {
	DatasourcesMigrated int
}

type MigrateDatasourcesRequestDTO struct {
	MigrateToPDC       bool `json:"migrateToPDC"`
	MigrateCredentials bool `json:"migrateCredentials"`
}

type MigrateDatasourcesResponseDTO struct {
	DatasourcesMigrated int `json:"datasourcesMigrated"`
}

// swagger:response cloudMigrationCreateTokenResponse
type CreateAccessTokenResponse struct {
	Token string
}

type CreateAccessTokenResponseDTO struct {
	Token string `json:"token"`
}

// Code below only exists for swagger to be happy

// swagger:parameters migrationWithIDPathParam
type GetMigrationParams struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`
}

// swagger:parameters migrationRunWithIDPathParam
type GetMigrationRunParams struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`

	// Run ID of a migration run
	//
	// in: path
	RunID int64 `json:"runID"`
}

// swagger:response 200okResponse
type OkResponse struct {
}

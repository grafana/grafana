package cloudmigration

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented", errutil.WithPublicMessage("Internal server error"))
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance"))
	ErrMigrationNotFound           = errutil.NotFound("cloudmigrations.migrationNotFound", errutil.WithPublicMessage("Migration not found"))
	ErrMigrationRunNotFound        = errutil.NotFound("cloudmigrations.migrationRunNotFound", errutil.WithPublicMessage("Migration run not found"))
	ErrMigrationNotDeleted         = errutil.Internal("cloudmigrations.migrationNotDeleted", errutil.WithPublicMessage("Migration not deleted"))
)

// cloud migration api dtos
type CloudMigration struct {
	ID          int64     `json:"id" xorm:"pk autoincr 'id'"`
	AuthToken   string    `json:"-"`
	Stack       string    `json:"stack"`
	StackID     int       `json:"stackID" xorm:"stack_id"`
	RegionSlug  string    `json:"regionSlug"`
	ClusterSlug string    `json:"clusterSlug"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
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

type CloudMigrationRun struct {
	ID                int64     `json:"id" xorm:"pk autoincr 'id'"`
	CloudMigrationUID string    `json:"uid" xorm:"cloud_migration_uid"`
	Result            []byte    `json:"result"` //store raw cms response body
	Created           time.Time `json:"created"`
	Updated           time.Time `json:"updated"`
	Finished          time.Time `json:"finished"`
}

type CloudMigrationRunList struct {
	Runs []MigrateDataResponseDTO `json:"runs"`
}

// swagger:parameters createMigration
type CloudMigrationRequest struct {
	AuthToken string `json:"authToken"`
}

type CloudMigrationResponse struct {
	ID      int64     `json:"id"`
	Stack   string    `json:"stack"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

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

// access token

type CreateAccessTokenResponse struct {
	Token string
}

type CreateAccessTokenResponseDTO struct {
	Token string `json:"token"`
}

type Base64EncodedTokenPayload struct {
	Token    string
	Instance Base64HGInstance
}

func (p Base64EncodedTokenPayload) ToMigration() CloudMigration {
	return CloudMigration{
		AuthToken:   p.Token,
		Stack:       p.Instance.Slug,
		StackID:     p.Instance.StackID,
		RegionSlug:  p.Instance.RegionSlug,
		ClusterSlug: p.Instance.ClusterSlug,
	}
}

type Base64HGInstance struct {
	StackID     int
	Slug        string
	RegionSlug  string
	ClusterSlug string
}

// dtos for cms api

type MigrateDataType string

const (
	DashboardDataType  MigrateDataType = "DASHBOARD"
	DatasourceDataType MigrateDataType = "DATASOURCE"
	FolderDataType     MigrateDataType = "FOLDER"
)

type MigrateDataRequestDTO struct {
	Items []MigrateDataRequestItemDTO `json:"items"`
}

type MigrateDataRequestItemDTO struct {
	Type  MigrateDataType `json:"type"`
	RefID string          `json:"refId"`
	Name  string          `json:"name"`
	Data  interface{}     `json:"data"`
}

type ItemStatus string

const (
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
)

type MigrateDataResponseDTO struct {
	RunID int64                        `json:"id"`
	Items []MigrateDataResponseItemDTO `json:"items"`
}

type MigrateDataResponseItemDTO struct {
	RefID  string     `json:"refId"`
	Status ItemStatus `json:"status"`
	Error  string     `json:"error,omitempty"`
}

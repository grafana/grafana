package cloudmigration

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented").Errorf("Internal server error")
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled").Errorf("Cloud migrations are disabled on this instance")
	ErrMigrationNotFound           = errutil.NotFound("cloudmigrations.sessionNotFound").Errorf("Session not found")
	ErrMigrationRunNotFound        = errutil.NotFound("cloudmigrations.migrationRunNotFound").Errorf("Migration run not found")
	ErrMigrationNotDeleted         = errutil.Internal("cloudmigrations.sessionNotDeleted").Errorf("Session not deleted")
	ErrTokenNotFound               = errutil.NotFound("cloudmigrations.tokenNotFound").Errorf("Token not found")
)

// CloudMigration api dtos
type CloudMigrationSession struct {
	ID          int64     `json:"id" xorm:"pk autoincr 'id'"`
	UID         string    `json:"uid" xorm:"uid"`
	AuthToken   string    `json:"-"`
	Slug        string    `json:"slug"`
	StackID     int       `json:"stackID" xorm:"stack_id"`
	RegionSlug  string    `json:"regionSlug"`
	ClusterSlug string    `json:"clusterSlug"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

type CloudMigrationSnapshot struct {
	ID         int64     `json:"id" xorm:"pk autoincr 'id'"`
	UID        string    `json:"uid" xorm:"uid"`
	SessionUID string    `json:"sessionUid" xorm:"session_uid"`
	Result     []byte    `json:"result"` //store raw gms response body
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
	Finished   time.Time `json:"finished"`
}

func (r CloudMigrationSnapshot) ToResponse() (*MigrateDataResponseDTO, error) {
	var result MigrateDataResponseDTO
	err := json.Unmarshal(r.Result, &result)
	if err != nil {
		return nil, errors.New("could not parse result of run")
	}
	result.RunUID = r.UID
	return &result, nil
}

type SnapshotList struct {
	Runs []MigrateDataResponseListDTO `json:"runs"`
}

type CloudMigrationSessionRequest struct {
	AuthToken string `json:"authToken"`
}

type CloudMigrationSessionResponse struct {
	UID     string    `json:"uid"`
	Slug    string    `json:"slug"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

type CloudMigrationSessionListResponse struct {
	Sessions []CloudMigrationSessionResponse `json:"sessions"`
}

// access token

type CreateAccessTokenResponse struct {
	Token string
}

type CreateAccessTokenResponseDTO struct {
	Token string `json:"token"`
}

type GetAccessTokenResponseDTO struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	ExpiresAt   string `json:"expiresAt"`
	FirstUsedAt string `json:"firstUsedAt"`
	LastUsedAt  string `json:"lastUsedAt"`
	CreatedAt   string `json:"createdAt"`
}

type Base64EncodedTokenPayload struct {
	Token    string
	Instance Base64HGInstance
}

func (p Base64EncodedTokenPayload) ToMigration() CloudMigrationSession {
	return CloudMigrationSession{
		AuthToken:   p.Token,
		Slug:        p.Instance.Slug,
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

// DTOs for GMS API

// swagger:enum MigrateDataType
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

// swagger:enum ItemStatus
type ItemStatus string

const (
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
)

type MigrateDataResponseDTO struct {
	RunUID string                       `json:"uid"`
	Items  []MigrateDataResponseItemDTO `json:"items"`
}

type MigrateDataResponseListDTO struct {
	RunUID string `json:"uid"`
}

type MigrateDataResponseItemDTO struct {
	// required:true
	Type MigrateDataType `json:"type"`
	// required:true
	RefID string `json:"refId"`
	// required:true
	Status ItemStatus `json:"status"`
	Error  string     `json:"error,omitempty"`
}

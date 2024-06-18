package cloudmigration

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented").Errorf("Internal server error")
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled").Errorf("Cloud migrations are disabled on this instance")
	ErrMigrationNotFound           = errutil.NotFound("cloudmigrations.sessionNotFound").Errorf("Session not found")
	ErrMigrationRunNotFound        = errutil.NotFound("cloudmigrations.migrationRunNotFound").Errorf("Migration run not found")
	ErrMigrationNotDeleted         = errutil.Internal("cloudmigrations.sessionNotDeleted").Errorf("Session not deleted")
	ErrTokenNotFound               = errutil.NotFound("cloudmigrations.tokenNotFound").Errorf("Token not found")
)

// CloudMigration domain structs
type CloudMigrationSession struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	UID         string `xorm:"uid"`
	AuthToken   string
	Slug        string
	StackID     int `xorm:"stack_id"`
	RegionSlug  string
	ClusterSlug string
	Created     time.Time
	Updated     time.Time
}

type CloudMigrationSnapshot struct {
	ID         int64  `xorm:"pk autoincr 'id'"`
	UID        string `xorm:"uid"`
	SessionUID string `xorm:"session_uid"`
	Result     []byte //store raw gms response body
	Created    time.Time
	Updated    time.Time
	Finished   time.Time
}

func (r CloudMigrationSnapshot) GetResult() (*MigrateDataResponse, error) {
	var result MigrateDataResponse
	err := json.Unmarshal(r.Result, &result)
	if err != nil {
		return nil, errors.New("could not parse result of run")
	}
	result.RunUID = r.UID
	return &result, nil
}

type SnapshotList struct {
	Runs []MigrateDataResponseList
}

type CloudMigrationSessionRequest struct {
	AuthToken string
}

type CloudMigrationSessionResponse struct {
	UID     string
	Slug    string
	Created time.Time
	Updated time.Time
}

type CloudMigrationSessionListResponse struct {
	Sessions []CloudMigrationSessionResponse
}

// access token

type CreateAccessTokenResponse struct {
	Token string
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

// GMS domain structs

type MigrateDataType string

const (
	DashboardDataType  MigrateDataType = "DASHBOARD"
	DatasourceDataType MigrateDataType = "DATASOURCE"
	FolderDataType     MigrateDataType = "FOLDER"
)

type MigrateDataRequest struct {
	Items []MigrateDataRequestItem
}

type MigrateDataRequestItem struct {
	Type  MigrateDataType
	RefID string
	Name  string
	Data  interface{}
}

type ItemStatus string

const (
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
)

type MigrateDataResponse struct {
	RunUID string
	Items  []MigrateDataResponseItem
}

type MigrateDataResponseList struct {
	RunUID string
}

type MigrateDataResponseItem struct {
	Type   MigrateDataType
	RefID  string
	Status ItemStatus
	Error  string
}

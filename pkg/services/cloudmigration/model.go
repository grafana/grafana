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
	ErrSnapshotNotFound            = errutil.NotFound("cloudmigrations.snapshotNotFound").Errorf("Snapshot not found")
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
	ID             int64  `xorm:"pk autoincr 'id'"`
	UID            string `xorm:"uid"`
	SessionUID     string `xorm:"session_uid"`
	Status         SnapshotStatus
	EncryptionKey  string `xorm:"encryption_key"` // stored in the unified secrets table
	UploadURL      string `xorm:"upload_url"`
	LocalDir       string `xorm:"local_directory"`
	GMSSnapshotUID string `xorm:"gms_snapshot_uid"`
	ErrorString    string `xorm:"error_string"`
	Created        time.Time
	Updated        time.Time
	Finished       time.Time

	// []MigrateDataResponseItem
	Result []byte `xorm:"result"` //store raw gms response body
}

type SnapshotStatus string

const (
	SnapshotStatusInitializing      = "initializing"
	SnapshotStatusCreating          = "creating"
	SnapshotStatusPendingUpload     = "pending_upload"
	SnapshotStatusUploading         = "uploading"
	SnapshotStatusPendingProcessing = "pending_processing"
	SnapshotStatusProcessing        = "processing"
	SnapshotStatusFinished          = "finished"
	SnapshotStatusError             = "error"
	SnapshotStatusUnknown           = "unknown"
)

type MigrationResource struct {
	ID  int64  `xorm:"pk autoincr 'id'"`
	UID string `xorm:"uid"`

	Type   MigrateDataType `xorm:"resource_type"`
	RefID  string          `xorm:"resource_uid"`
	Status ItemStatus      `xorm:"status"`
	Error  string          `xorm:"error_string"`

	SnapshotUID string `xorm:"snapshot_uid"`
}

// Deprecated, use GetSnapshotResult for the async workflow
func (s CloudMigrationSnapshot) GetResult() (*MigrateDataResponse, error) {
	var result MigrateDataResponse
	err := json.Unmarshal(s.Result, &result)
	if err != nil {
		return nil, errors.New("could not parse result of run")
	}
	result.RunUID = s.UID
	return &result, nil
}

func (s CloudMigrationSnapshot) ShouldQueryGMS() bool {
	return s.Status == SnapshotStatusPendingProcessing || s.Status == SnapshotStatusProcessing
}

func (s CloudMigrationSnapshot) GetSnapshotResult() ([]MigrationResource, error) {
	var result []MigrationResource
	if len(s.Result) > 0 {
		err := json.Unmarshal(s.Result, &result)
		if err != nil {
			return nil, errors.New("could not parse result of run")
		}
	}
	return result, nil
}

type CloudMigrationRunList struct {
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

type ListSnapshotsQuery struct {
	SessionUID string
	Offset     int
	Limit      int
}

type UpdateSnapshotCmd struct {
	UID    string
	Status SnapshotStatus
	Result []byte //store raw gms response body
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
	Items  []MigrationResource
}

type MigrateDataResponseList struct {
	RunUID string
}

type CreateSessionResponse struct {
	SnapshotUid string
}

type InitializeSnapshotResponse struct {
	EncryptionKey  string
	UploadURL      string
	GMSSnapshotUID string
}

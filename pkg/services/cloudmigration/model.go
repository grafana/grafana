package cloudmigration

import (
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

// CloudMigrationSession represents a configured migration token
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

// CloudMigrationSnapshot contains all of the metadata about a snapshot
type CloudMigrationSnapshot struct {
	ID             int64  `xorm:"pk autoincr 'id'"`
	UID            string `xorm:"uid"`
	SessionUID     string `xorm:"session_uid"`
	Status         SnapshotStatus
	EncryptionKey  []byte `xorm:"encryption_key"` // stored in the unified secrets table
	LocalDir       string `xorm:"local_directory"`
	GMSSnapshotUID string `xorm:"gms_snapshot_uid"`
	ErrorString    string `xorm:"error_string"`
	Created        time.Time
	Updated        time.Time
	Finished       time.Time

	// Stored in the cloud_migration_resource table
	Resources []CloudMigrationResource `xorm:"-"`
	// Derived by querying the cloud_migration_resource table
	StatsRollup SnapshotResourceStats `xorm:"-"`
}

type SnapshotStatus string

const (
	SnapshotStatusCreating          SnapshotStatus = "creating"
	SnapshotStatusPendingUpload     SnapshotStatus = "pending_upload"
	SnapshotStatusUploading         SnapshotStatus = "uploading"
	SnapshotStatusPendingProcessing SnapshotStatus = "pending_processing"
	SnapshotStatusProcessing        SnapshotStatus = "processing"
	SnapshotStatusFinished          SnapshotStatus = "finished"
	SnapshotStatusCanceled          SnapshotStatus = "canceled"
	SnapshotStatusError             SnapshotStatus = "error"
)

type CloudMigrationResource struct {
	ID  int64  `xorm:"pk autoincr 'id'"`
	UID string `xorm:"uid"`

	Type   MigrateDataType `xorm:"resource_type" json:"type"`
	RefID  string          `xorm:"resource_uid" json:"refId"`
	Status ItemStatus      `xorm:"status" json:"status"`
	Error  string          `xorm:"error_string" json:"error"`

	SnapshotUID string `xorm:"snapshot_uid"`
}

type MigrateDataType string

const (
	DashboardDataType  MigrateDataType = "DASHBOARD"
	DatasourceDataType MigrateDataType = "DATASOURCE"
	FolderDataType     MigrateDataType = "FOLDER"
)

type ItemStatus string

const (
	ItemStatusOK      ItemStatus = "OK"
	ItemStatusError   ItemStatus = "ERROR"
	ItemStatusPending ItemStatus = "PENDING"
)

type SnapshotResourceStats struct {
	CountsByType   map[MigrateDataType]int
	CountsByStatus map[ItemStatus]int
	Total          int
}

// Deprecated, use GetSnapshotResult for the async workflow
func (s CloudMigrationSnapshot) GetResult() (*MigrateDataResponse, error) {
	result := MigrateDataResponse{
		RunUID: s.UID,
		Items:  s.Resources,
	}
	return &result, nil
}

func (s CloudMigrationSnapshot) ShouldQueryGMS() bool {
	return s.Status == SnapshotStatusPendingProcessing || s.Status == SnapshotStatusProcessing
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

type GetSnapshotsQuery struct {
	SnapshotUID string
	SessionUID  string
	ResultPage  int
	ResultLimit int
}

type ListSnapshotsQuery struct {
	SessionUID string
	Page       int
	Limit      int
}

type UpdateSnapshotCmd struct {
	UID       string
	Status    SnapshotStatus
	Resources []CloudMigrationResource
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

type MigrateDataRequest struct {
	Items []MigrateDataRequestItem
}

type MigrateDataRequestItem struct {
	Type  MigrateDataType
	RefID string
	Name  string
	Data  interface{}
}

type MigrateDataResponse struct {
	RunUID string
	Items  []CloudMigrationResource
}

type MigrateDataResponseList struct {
	RunUID string
}

type CreateSessionResponse struct {
	SnapshotUid string
}

type StartSnapshotResponse struct {
	SnapshotID           string `json:"snapshotID"`
	MaxItemsPerPartition uint32 `json:"maxItemsPerPartition"`
	Algo                 string `json:"algo"`
	EncryptionKey        []byte `json:"encryptionKey"`
	Metadata             []byte `json:"metadata"`
}

// Based on Grafana Migration Service DTOs
type GetSnapshotStatusResponse struct {
	State   SnapshotState            `json:"state"`
	Results []CloudMigrationResource `json:"results"`
}

type SnapshotState string

const (
	SnapshotStateInitialized SnapshotState = "INITIALIZED"
	SnapshotStateProcessing  SnapshotState = "PROCESSING"
	SnapshotStateFinished    SnapshotState = "FINISHED"
	SnapshotStateCanceled    SnapshotState = "CANCELED"
	SnapshotStateError       SnapshotState = "ERROR"
	SnapshotStateUnknown     SnapshotState = "UNKNOWN"
)

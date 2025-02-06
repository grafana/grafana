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
	OrgID       int64  `xorm:"org_id"`
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
	EncryptionKey  []byte `xorm:"-"` // stored in the unified secrets table
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
	UID string `xorm:"uid" json:"uid"`

	Name      string            `xorm:"name" json:"name"`
	Type      MigrateDataType   `xorm:"resource_type" json:"type"`
	RefID     string            `xorm:"resource_uid" json:"refId"`
	Status    ItemStatus        `xorm:"status" json:"status"`
	Error     string            `xorm:"error_string" json:"error"`
	ErrorCode ResourceErrorCode `xorm:"error_code" json:"error_code"`

	SnapshotUID string `xorm:"snapshot_uid"`
	ParentName  string `xorm:"parent_name" json:"parentName"`
}

type MigrateDataType string

const (
	DashboardDataType        MigrateDataType = "DASHBOARD"
	DatasourceDataType       MigrateDataType = "DATASOURCE"
	FolderDataType           MigrateDataType = "FOLDER"
	LibraryElementDataType   MigrateDataType = "LIBRARY_ELEMENT"
	AlertRuleType            MigrateDataType = "ALERT_RULE"
	AlertRuleGroupType       MigrateDataType = "ALERT_RULE_GROUP"
	ContactPointType         MigrateDataType = "CONTACT_POINT"
	NotificationPolicyType   MigrateDataType = "NOTIFICATION_POLICY"
	NotificationTemplateType MigrateDataType = "NOTIFICATION_TEMPLATE"
	MuteTimingType           MigrateDataType = "MUTE_TIMING"
	PluginDataType           MigrateDataType = "PLUGIN"
)

type ItemStatus string

const (
	// Returned by GMS
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
	// Used by default while awaiting GMS results
	ItemStatusPending ItemStatus = "PENDING"
)

type ResourceErrorCode string

const (
	ErrDatasourceNameConflict     ResourceErrorCode = "DATASOURCE_NAME_CONFLICT"
	ErrDatasourceInvalidURL       ResourceErrorCode = "DATASOURCE_INVALID_URL"
	ErrDatasourceAlreadyManaged   ResourceErrorCode = "DATASOURCE_ALREADY_MANAGED"
	ErrFolderNameConflict         ResourceErrorCode = "FOLDER_NAME_CONFLICT"
	ErrDashboardAlreadyManaged    ResourceErrorCode = "DASHBOARD_ALREADY_MANAGED"
	ErrLibraryElementNameConflict ResourceErrorCode = "LIBRARY_ELEMENT_NAME_CONFLICT"
	ErrUnsupportedDataType        ResourceErrorCode = "UNSUPPORTED_DATA_TYPE"
	ErrResourceConflict           ResourceErrorCode = "RESOURCE_CONFLICT"
	ErrUnexpectedStatus           ResourceErrorCode = "UNEXPECTED_STATUS_CODE"
	ErrInternalServiceError       ResourceErrorCode = "INTERNAL_SERVICE_ERROR"
	ErrGeneric                    ResourceErrorCode = "GENERIC_ERROR"
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
	// OrgId in the on prem instance
	OrgID int64
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
	OrgID       int64
	SessionUID  string
	ResultPage  int
	ResultLimit int
}

type ListSnapshotsQuery struct {
	SessionUID string
	OrgID      int64
	Page       int
	Limit      int
	Sort       string
}

type UpdateSnapshotCmd struct {
	UID       string
	SessionID string
	Status    SnapshotStatus

	// LocalResourcesToCreate represents the local state of a resource before it has been uploaded to GMS
	LocalResourcesToCreate []CloudMigrationResource
	// CloudResourcesToUpdate represents resource state from GMS, to be merged with the local state
	CloudResourcesToUpdate []CloudMigrationResource
}

// access token

type CreateAccessTokenResponse struct {
	Token string
}

type Base64EncodedTokenPayload struct {
	Token    string
	Instance Base64HGInstance
}

func (p Base64EncodedTokenPayload) ToMigration(orgID int64) CloudMigrationSession {
	return CloudMigrationSession{
		AuthToken:   p.Token,
		Slug:        p.Instance.Slug,
		StackID:     p.Instance.StackID,
		RegionSlug:  p.Instance.RegionSlug,
		ClusterSlug: p.Instance.ClusterSlug,
		OrgID:       orgID,
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
	Items           []MigrateDataRequestItem
	ItemParentNames map[MigrateDataType]map[string](string)
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

var (
	ErrTokenInvalid           = errutil.Internal("cloudmigrations.createMigration.tokenInvalid", errutil.WithPublicMessage("Token is not valid. Generate a new token on your cloud instance and try again."))
	ErrTokenRequestError      = errutil.Internal("cloudmigrations.createMigration.tokenRequestError", errutil.WithPublicMessage("An error occurred while validating the token. Please check the Grafana instance logs."))
	ErrTokenValidationFailure = errutil.Internal("cloudmigrations.createMigration.tokenValidationFailure", errutil.WithPublicMessage("Token is not valid. Please ensure the token matches the migration token on your cloud instance."))
	ErrInstanceUnreachable    = errutil.Internal("cloudmigrations.createMigration.instanceUnreachable", errutil.WithPublicMessage("The cloud instance cannot be reached. Make sure the instance is running and try again."))
	ErrInstanceRequestError   = errutil.Internal("cloudmigrations.createMigration.instanceRequestError", errutil.WithPublicMessage("An error occurred while attempting to verify the cloud instance's connectivity. Please check the network settings or cloud instance status."))
	ErrSessionCreationFailure = errutil.Internal("cloudmigrations.createMigration.sessionCreationFailure", errutil.WithPublicMessage("There was an error creating the migration. Please try again."))
	ErrMigrationDisabled      = errutil.Internal("cloudmigrations.createMigration.migrationDisabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance."))
)

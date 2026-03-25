package v1beta1

import (
	v0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// v1beta1 uses the same types as v0alpha1, just served under a different API version.
// This allows us to provide multiple API versions without duplicating type definitions.

// Repository types
type (
	Repository                = v0alpha1.Repository
	RepositoryList            = v0alpha1.RepositoryList
	RepositorySpec            = v0alpha1.RepositorySpec
	RepositoryStatus          = v0alpha1.RepositoryStatus
	SecureValues              = v0alpha1.SecureValues
	LocalRepositoryConfig     = v0alpha1.LocalRepositoryConfig
	GitRepositoryConfig       = v0alpha1.GitRepositoryConfig
	GitHubRepositoryConfig    = v0alpha1.GitHubRepositoryConfig
	GitLabRepositoryConfig    = v0alpha1.GitLabRepositoryConfig
	BitbucketRepositoryConfig = v0alpha1.BitbucketRepositoryConfig
	SyncOptions               = v0alpha1.SyncOptions
	WebhookConfig             = v0alpha1.WebhookConfig
	SyncStatus                = v0alpha1.SyncStatus
	WebhookStatus             = v0alpha1.WebhookStatus
	TokenStatus               = v0alpha1.TokenStatus
)

// Repository type constants
const (
	LocalRepositoryType     = v0alpha1.LocalRepositoryType
	GitRepositoryType       = v0alpha1.GitRepositoryType
	GitHubRepositoryType    = v0alpha1.GitHubRepositoryType
	GitLabRepositoryType    = v0alpha1.GitLabRepositoryType
	BitbucketRepositoryType = v0alpha1.BitbucketRepositoryType
)

// Connection types
type (
	Connection                = v0alpha1.Connection
	ConnectionList            = v0alpha1.ConnectionList
	ConnectionSpec            = v0alpha1.ConnectionSpec
	ConnectionStatus          = v0alpha1.ConnectionStatus
	ConnectionType            = v0alpha1.ConnectionType
	ConnectionSecure          = v0alpha1.ConnectionSecure
	ConnectionInfo            = v0alpha1.ConnectionInfo
	GitHubConnectionConfig    = v0alpha1.GitHubConnectionConfig
	GitlabConnectionConfig    = v0alpha1.GitlabConnectionConfig
	BitbucketConnectionConfig = v0alpha1.BitbucketConnectionConfig
	ExternalRepository        = v0alpha1.ExternalRepository
	ExternalRepositoryList    = v0alpha1.ExternalRepositoryList
)

// Connection type constants
const (
	GithubConnectionType    = v0alpha1.GithubConnectionType
	GitlabConnectionType    = v0alpha1.GitlabConnectionType
	BitbucketConnectionType = v0alpha1.BitbucketConnectionType
)

// Job types
type (
	Job                         = v0alpha1.Job
	JobList                     = v0alpha1.JobList
	JobSpec                     = v0alpha1.JobSpec
	JobStatus                   = v0alpha1.JobStatus
	JobState                    = v0alpha1.JobState
	SyncJobOptions              = v0alpha1.SyncJobOptions
	ExportJobOptions            = v0alpha1.ExportJobOptions
	DeleteJobOptions            = v0alpha1.DeleteJobOptions
	FixFolderMetadataJobOptions = v0alpha1.FixFolderMetadataJobOptions
	HistoricJob                 = v0alpha1.HistoricJob
	HistoricJobList             = v0alpha1.HistoricJobList
)

// Job state constants
const (
	JobStatePending = v0alpha1.JobStatePending
	JobStateWorking = v0alpha1.JobStateWorking
	JobStateSuccess = v0alpha1.JobStateSuccess
	JobStateError   = v0alpha1.JobStateError
	JobStateWarning = v0alpha1.JobStateWarning
)

// Job action constants
const (
	JobActionPull                 = v0alpha1.JobActionPull
	JobActionPush                 = v0alpha1.JobActionPush
	JobActionPullRequest          = v0alpha1.JobActionPullRequest
	JobActionMigrate              = v0alpha1.JobActionMigrate
	JobActionDelete               = v0alpha1.JobActionDelete
	JobActionMove                 = v0alpha1.JobActionMove
	JobActionFixFolderMetadata    = v0alpha1.JobActionFixFolderMetadata
	JobActionReleaseResources     = v0alpha1.JobActionReleaseResources
	JobActionDeleteResources      = v0alpha1.JobActionDeleteResources
)

// Other types
type (
	WebhookResponse  = v0alpha1.WebhookResponse
	ResourceWrapper  = v0alpha1.ResourceWrapper
	FileList         = v0alpha1.FileList
	FileItem         = v0alpha1.FileItem
	HistoryList      = v0alpha1.HistoryList
	HistoryItem      = v0alpha1.HistoryItem
	TestResults      = v0alpha1.TestResults
	ErrorDetails     = v0alpha1.ErrorDetails
	ResourceList     = v0alpha1.ResourceList
	ResourceStats    = v0alpha1.ResourceStats
	ResourceCount    = v0alpha1.ResourceCount
	ManagerStats     = v0alpha1.ManagerStats
	RefList          = v0alpha1.RefList
	RefItem          = v0alpha1.RefItem
	Author           = v0alpha1.Author
	ResourceRef      = v0alpha1.ResourceRef
	HealthStatus     = v0alpha1.HealthStatus
	QuotaStatus      = v0alpha1.QuotaStatus
)

// Health error constants
const (
	HealthFailureHealth = v0alpha1.HealthFailureHealth
)

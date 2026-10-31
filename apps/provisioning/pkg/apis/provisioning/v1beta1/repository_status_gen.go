// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// ErrorDetails describes an individual field error intended to help users identify and fix issues
// in resource specifications. This type is modeled after Kubernetes' StatusCause and serves the same
// purpose: to deliver actionable feedback about fields in the spec that require attention.
// Errors may relate to invalid formats, missing or invalid values, or cases where a referenced value
// does not exist in an external system (not strictly format or syntax errors). Use ErrorDetails to
// communicate validation or external reference errors that users can resolve by editing spec fields.
// TODO: Rename this type to FieldError for consistency with Kubernetes conventions and to more clearly indicate that it represents field-level validation errors, not arbitrary error details.
// +k8s:openapi-gen=true
type RepositoryErrorDetails struct {
	// Type is a machine-readable description of the cause of the error.
	// This is intended for programmatic handling and matches Kubernetes' CauseType values.
	Type string `json:"type"`
	// Field is the path to the field or JSON pointer that caused the error.
	// This helps users and tools identify exactly where to correct the problem.
	// This field is optional and may be empty if not applicable.
	Field *string `json:"field,omitempty"`
	// Detail provides a human-readable explanation of what went wrong.
	// This message may be shown directly to users and should be actionable.
	Detail *string `json:"detail,omitempty"`
	// Origin indicates where the error originated in validation, or the name of the external service that reported the error.
	// This can be useful for tooling or debugging, and may reference a specific rule, function, or service.
	// This field is optional and may be empty.
	Origin *string `json:"origin,omitempty"`
	// BadValue is the value of the field that was determined to be invalid, if applicable.
	// This can be any type. This field is optional and may be omitted if not relevant.
	BadValue interface{} `json:"badValue,omitempty"`
}

// NewRepositoryErrorDetails creates a new RepositoryErrorDetails object.
func NewRepositoryErrorDetails() *RepositoryErrorDetails {
	return &RepositoryErrorDetails{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryErrorDetails.
func (RepositoryErrorDetails) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryErrorDetails"
}

// +k8s:openapi-gen=true
type RepositoryCondition struct {
	Type               string                    `json:"type"`
	Status             RepositoryConditionStatus `json:"status"`
	ObservedGeneration *int64                    `json:"observedGeneration,omitempty"`
	LastTransitionTime string                    `json:"lastTransitionTime"`
	Reason             string                    `json:"reason"`
	Message            string                    `json:"message"`
}

// NewRepositoryCondition creates a new RepositoryCondition object.
func NewRepositoryCondition() *RepositoryCondition {
	return &RepositoryCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryCondition.
func (RepositoryCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryCondition"
}

// +k8s:openapi-gen=true
type RepositoryHealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`
	// The type of the error
	Error *RepositoryHealthStatusError `json:"error,omitempty"`
	// When the health was checked last time
	Checked *int64 `json:"checked,omitempty"`
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	Message []string `json:"message,omitempty"`
}

// NewRepositoryHealthStatus creates a new RepositoryHealthStatus object.
func NewRepositoryHealthStatus() *RepositoryHealthStatus {
	return &RepositoryHealthStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryHealthStatus.
func (RepositoryHealthStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryHealthStatus"
}

// +k8s:openapi-gen=true
type RepositorySyncStatus struct {
	// pending, running, success, error
	State RepositorySyncStatusState `json:"state"`
	// The ID for the job that ran this sync
	Job *string `json:"job,omitempty"`
	// When the sync job started
	Started *int64 `json:"started,omitempty"`
	// When the sync job finished
	Finished *int64 `json:"finished,omitempty"`
	// When the controller last attempted a sync or an interval check (Unix milliseconds).
	LastChecked *int64 `json:"lastChecked,omitempty"`
	// When the next sync check is scheduled
	Scheduled *int64 `json:"scheduled,omitempty"`
	// Summary messages (will be shown to users)
	Message []string `json:"message"`
	// The repository ref when the last successful sync ran
	LastRef *string `json:"lastRef,omitempty"`
	// Incremental synchronization for versioned repositories
	Incremental *bool `json:"incremental,omitempty"`
}

// NewRepositorySyncStatus creates a new RepositorySyncStatus object.
func NewRepositorySyncStatus() *RepositorySyncStatus {
	return &RepositorySyncStatus{
		Message: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for RepositorySyncStatus.
func (RepositorySyncStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySyncStatus"
}

// +k8s:openapi-gen=true
type RepositoryResourceCount struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

// NewRepositoryResourceCount creates a new RepositoryResourceCount object.
func NewRepositoryResourceCount() *RepositoryResourceCount {
	return &RepositoryResourceCount{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryResourceCount.
func (RepositoryResourceCount) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryResourceCount"
}

// +k8s:openapi-gen=true
type RepositoryWebhookStatus struct {
	// TODO: consolidate ID and UUID into a single string identifier in the next api version.
	Id               *int64   `json:"id,omitempty"`
	Uuid             *string  `json:"uuid,omitempty"`
	Url              *string  `json:"url,omitempty"`
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
	LastEvent        *int64   `json:"lastEvent,omitempty"`
	LastRotated      *int64   `json:"lastRotated,omitempty"`
}

// NewRepositoryWebhookStatus creates a new RepositoryWebhookStatus object.
func NewRepositoryWebhookStatus() *RepositoryWebhookStatus {
	return &RepositoryWebhookStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryWebhookStatus.
func (RepositoryWebhookStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryWebhookStatus"
}

// +k8s:openapi-gen=true
type RepositoryTokenStatus struct {
	LastUpdated *int64 `json:"lastUpdated,omitempty"`
	Expiration  *int64 `json:"expiration,omitempty"`
}

// NewRepositoryTokenStatus creates a new RepositoryTokenStatus object.
func NewRepositoryTokenStatus() *RepositoryTokenStatus {
	return &RepositoryTokenStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryTokenStatus.
func (RepositoryTokenStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryTokenStatus"
}

// DeletionStatus reports the progress of an in-progress deletion and the problem
// blocking it. It is populated while the repository is Terminating and its
// finalizers run, so a client can explain the holdup and force-remove the
// blocking finalizer.
// +k8s:openapi-gen=true
type RepositoryDeletionStatus struct {
	// State is the phase of the deletion.
	State *string `json:"state,omitempty"`
	// Finalizer names the finalizer whose teardown is blocking deletion, i.e.
	// which deletion step failed. A client force-removing deletion removes exactly
	// this finalizer.
	Finalizer *string `json:"finalizer,omitempty"`
	// Message is a human-readable explanation of what went wrong, suitable for
	// showing to users.
	Message *string `json:"message,omitempty"`
	// Cause classifies the blocking error. It may be absent on older statuses.
	Cause *RepositoryDeletionStatusCause `json:"cause,omitempty"`
}

// NewRepositoryDeletionStatus creates a new RepositoryDeletionStatus object.
func NewRepositoryDeletionStatus() *RepositoryDeletionStatus {
	return &RepositoryDeletionStatus{
		State: (func(input string) *string { return &input })("Blocked"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryDeletionStatus.
func (RepositoryDeletionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryDeletionStatus"
}

// QuotaStatus represents the quota limits configured for this repository.
// +k8s:openapi-gen=true
type RepositoryQuotaStatus struct {
	// MaxRepositories is the maximum number of repositories allowed.
	// 0 means unlimited.
	MaxRepositories *int64 `json:"maxRepositories,omitempty"`
	// MaxResourcesPerRepository is the maximum number of resources allowed per repository.
	// 0 means unlimited.
	MaxResourcesPerRepository *int64 `json:"maxResourcesPerRepository,omitempty"`
	// UpdatedAt is when the controller last successfully refreshed these quota limits.
	// It is expressed as Unix milliseconds. 0 means the quota limits have not been refreshed yet.
	UpdatedAt *int64 `json:"updatedAt,omitempty"`
}

// NewRepositoryQuotaStatus creates a new RepositoryQuotaStatus object.
func NewRepositoryQuotaStatus() *RepositoryQuotaStatus {
	return &RepositoryQuotaStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryQuotaStatus.
func (RepositoryQuotaStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryQuotaStatus"
}

// +k8s:openapi-gen=true
type RepositoryStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`
	// FieldErrors are errors that occurred during validation of the repository spec.
	// These errors are intended to help users identify and fix issues in the spec.
	FieldErrors []RepositoryErrorDetails `json:"fieldErrors,omitempty"`
	// Conditions represent the latest available observations of the repository's state.
	Conditions []RepositoryCondition `json:"conditions,omitempty"`
	// This will get updated with the current health status (and updated periodically)
	Health RepositoryHealthStatus `json:"health"`
	// Sync information with the last sync information
	Sync RepositorySyncStatus `json:"sync"`
	// The object count when sync last ran
	Stats []RepositoryResourceCount `json:"stats,omitempty"`
	// Webhook Information (if applicable)
	Webhook RepositoryWebhookStatus `json:"webhook"`
	// Token will get updated with current token information
	Token *RepositoryTokenStatus `json:"token,omitempty"`
	// Error information during repository deletion (if any).
	// Deprecated: prefer the structured Deletion field. Retained for
	// backwards compatibility with clients that read the concise string.
	DeleteError *string `json:"deleteError,omitempty"`
	// Deletion reports the progress of an in-progress deletion and the problem
	// blocking it, so a client can explain the holdup and force-remove the
	// blocking finalizer. Populated only while the repository is Terminating.
	Deletion *RepositoryDeletionStatus `json:"deletion,omitempty"`
	// Quota contains the configured quota limits for this repository
	Quota *RepositoryQuotaStatus `json:"quota,omitempty"`
}

// NewRepositoryStatus creates a new RepositoryStatus object.
func NewRepositoryStatus() *RepositoryStatus {
	return &RepositoryStatus{
		Health:  *NewRepositoryHealthStatus(),
		Sync:    *NewRepositorySyncStatus(),
		Webhook: *NewRepositoryWebhookStatus(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryStatus.
func (RepositoryStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryStatus"
}

// +k8s:openapi-gen=true
type RepositoryConditionStatus string

const (
	RepositoryConditionStatusTrue    RepositoryConditionStatus = "True"
	RepositoryConditionStatusFalse   RepositoryConditionStatus = "False"
	RepositoryConditionStatusUnknown RepositoryConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for RepositoryConditionStatus.
func (RepositoryConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryConditionStatus"
}

// +k8s:openapi-gen=true
type RepositoryHealthStatusError string

const (
	RepositoryHealthStatusErrorHook   RepositoryHealthStatusError = "hook"
	RepositoryHealthStatusErrorHealth RepositoryHealthStatusError = "health"
)

// OpenAPIModelName returns the OpenAPI model name for RepositoryHealthStatusError.
func (RepositoryHealthStatusError) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryHealthStatusError"
}

// +k8s:openapi-gen=true
type RepositorySyncStatusState string

const (
	RepositorySyncStatusStatePending RepositorySyncStatusState = "pending"
	RepositorySyncStatusStateWorking RepositorySyncStatusState = "working"
	RepositorySyncStatusStateSuccess RepositorySyncStatusState = "success"
	RepositorySyncStatusStateError   RepositorySyncStatusState = "error"
	RepositorySyncStatusStateWarning RepositorySyncStatusState = "warning"
)

// OpenAPIModelName returns the OpenAPI model name for RepositorySyncStatusState.
func (RepositorySyncStatusState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySyncStatusState"
}

// +k8s:openapi-gen=true
type RepositoryDeletionStatusCause string

const (
	RepositoryDeletionStatusCauseUser   RepositoryDeletionStatusCause = "user"
	RepositoryDeletionStatusCauseSystem RepositoryDeletionStatusCause = "system"
)

// OpenAPIModelName returns the OpenAPI model name for RepositoryDeletionStatusCause.
func (RepositoryDeletionStatusCause) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryDeletionStatusCause"
}

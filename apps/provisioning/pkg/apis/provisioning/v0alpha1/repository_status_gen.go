// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:openapi-gen=true
type HealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`
	// The type of the error
	Error HealthFailureType `json:"error,omitempty"`
	// When the health was checked last time
	Checked int64 `json:"checked,omitempty"`
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	// +listType=atomic
	Message []string `json:"message,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for HealthStatus.
func (HealthStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.HealthStatus"
}

// +k8s:openapi-gen=true
type SyncStatus struct {
	// pending, running, success, error
	State JobState `json:"state"`
	// The ID for the job that ran this sync
	JobID string `json:"job,omitempty"`
	// When the sync job started
	Started int64 `json:"started,omitempty"`
	// When the sync job finished
	Finished int64 `json:"finished,omitempty"`
	// When the controller last attempted a sync or an interval check (Unix milliseconds).
	LastChecked int64 `json:"lastChecked,omitempty"`
	// When the next sync check is scheduled
	Scheduled int64 `json:"scheduled,omitempty"`
	// Summary messages (will be shown to users)
	// +listType=atomic
	Message []string `json:"message"`
	// The repository ref when the last successful sync ran
	LastRef string `json:"lastRef,omitempty"`
	// Incremental synchronization for versioned repositories
	Incremental bool `json:"incremental,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for SyncStatus.
func (SyncStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.SyncStatus"
}

// +k8s:openapi-gen=true
type ResourceCount struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

// OpenAPIModelName returns the OpenAPI model name for ResourceCount.
func (ResourceCount) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ResourceCount"
}

// +k8s:openapi-gen=true
type WebhookStatus struct {
	// TODO: consolidate ID and UUID into a single string identifier in the next api version.
	ID   int64  `json:"id,omitempty"`
	UUID string `json:"uuid,omitempty"`
	URL  string `json:"url,omitempty"`
	// +listType=atomic
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
	LastEvent        int64    `json:"lastEvent,omitempty"`
	LastRotated      int64    `json:"lastRotated,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for WebhookStatus.
func (WebhookStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.WebhookStatus"
}

// +k8s:openapi-gen=true
type TokenStatus struct {
	LastUpdated int64 `json:"lastUpdated,omitempty"`
	Expiration  int64 `json:"expiration,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for TokenStatus.
func (TokenStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.TokenStatus"
}

// DeletionStatus reports the progress of an in-progress deletion and the problem
// blocking it. It is populated while the repository is Terminating and its
// finalizers run, so a client can explain the holdup and force-remove the
// blocking finalizer.
// +k8s:openapi-gen=true
type DeletionStatus struct {
	// State is the phase of the deletion.
	State DeletionState `json:"state,omitempty"`
	// Finalizer names the finalizer whose teardown is blocking deletion, i.e.
	// which deletion step failed. A client force-removing deletion removes exactly
	// this finalizer.
	Finalizer string `json:"finalizer,omitempty"`
	// Message is a human-readable explanation of what went wrong, suitable for
	// showing to users.
	Message string `json:"message,omitempty"`
	// Cause classifies the blocking error. It may be absent on older statuses.
	Cause DeletionCause `json:"cause,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for DeletionStatus.
func (DeletionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.DeletionStatus"
}

// QuotaStatus represents the quota limits configured for this repository.
// +k8s:openapi-gen=true
type QuotaStatus struct {
	// MaxRepositories is the maximum number of repositories allowed.
	// 0 means unlimited.
	MaxRepositories int64 `json:"maxRepositories,omitempty"`
	// MaxResourcesPerRepository is the maximum number of resources allowed per repository.
	// 0 means unlimited.
	MaxResourcesPerRepository int64 `json:"maxResourcesPerRepository,omitempty"`
	// UpdatedAt is when the controller last successfully refreshed these quota limits.
	// It is expressed as Unix milliseconds. 0 means the quota limits have not been refreshed yet.
	UpdatedAt int64 `json:"updatedAt,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for QuotaStatus.
func (QuotaStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.QuotaStatus"
}

// +k8s:openapi-gen=true
type RepositoryStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`
	// FieldErrors are errors that occurred during validation of the repository spec.
	// These errors are intended to help users identify and fix issues in the spec.
	// +listType=atomic
	FieldErrors []ErrorDetails `json:"fieldErrors,omitempty"`
	// Conditions represent the latest available observations of the repository's state.
	// +listType=map
	// +listMapKey=type
	// +patchMergeKey=type
	// +patchStrategy=merge
	Conditions []metav1.Condition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
	// This will get updated with the current health status (and updated periodically)
	Health HealthStatus `json:"health"`
	// Sync information with the last sync information
	Sync SyncStatus `json:"sync"`
	// The object count when sync last ran
	// +listType=atomic
	Stats []ResourceCount `json:"stats,omitempty"`
	// Webhook Information (if applicable)
	Webhook *WebhookStatus `json:"webhook"`
	// Token will get updated with current token information
	Token TokenStatus `json:"token,omitempty"`
	// Error information during repository deletion (if any).
	// Deprecated: prefer the structured Deletion field. Retained for
	// backwards compatibility with clients that read the concise string.
	DeleteError string `json:"deleteError,omitempty"`
	// Deletion reports the progress of an in-progress deletion and the problem
	// blocking it, so a client can explain the holdup and force-remove the
	// blocking finalizer. Populated only while the repository is Terminating.
	Deletion *DeletionStatus `json:"deletion,omitempty"`
	// Quota contains the configured quota limits for this repository
	Quota QuotaStatus `json:"quota,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryStatus.
func (RepositoryStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositoryStatus"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +enum
// +k8s:openapi-gen=true
type HistoricJobState string

const (
	HistoricJobStatePending HistoricJobState = "pending"
	HistoricJobStateWorking HistoricJobState = "working"
	HistoricJobStateSuccess HistoricJobState = "success"
	HistoricJobStateWarning HistoricJobState = "warning"
	HistoricJobStateError   HistoricJobState = "error"
)

// OpenAPIModelName returns the OpenAPI model name for HistoricJobState.
func (HistoricJobState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.HistoricJobState"
}

// +k8s:openapi-gen=true
type HistoricJobResourceSummary struct {
	Group *string `json:"group,omitempty"`
	Kind  *string `json:"kind,omitempty"`
	// The count (if known)
	Total  *int64 `json:"total,omitempty"`
	Create *int64 `json:"create,omitempty"`
	Update *int64 `json:"update,omitempty"`
	Delete *int64 `json:"delete,omitempty"`
	// Create or update (export)
	Write *int64 `json:"write,omitempty"`
	// The error count
	Error *int64 `json:"error,omitempty"`
	// The warning count
	Warning *int64 `json:"warning,omitempty"`
	// No action required (useful for sync)
	Noop *int64 `json:"noop,omitempty"`
	// TotalChanges is the action-aware count of resources changed for this group/kind,
	// set by the progress recorder as results are recorded. Used for the job-duration
	// histogram's resources_changed bucket.
	TotalChanges *int64 `json:"totalChanges,omitempty"`
	// Report errors/warnings for this resource type
	// This may not be an exhaustive list and recommend looking at the logs for more info
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

// NewHistoricJobResourceSummary creates a new HistoricJobResourceSummary object.
func NewHistoricJobResourceSummary() *HistoricJobResourceSummary {
	return &HistoricJobResourceSummary{}
}

// OpenAPIModelName returns the OpenAPI model name for HistoricJobResourceSummary.
func (HistoricJobResourceSummary) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.HistoricJobResourceSummary"
}

// +k8s:openapi-gen=true
type HistoricJobRepositoryURLs struct {
	// A URL pointing to the repository this lives in
	RepositoryURL *string `json:"repositoryURL,omitempty"`
	// A URL pointing to the file or ref in the repository
	SourceURL *string `json:"sourceURL,omitempty"`
	// A URL that will create a new pull request for this branch
	NewPullRequestURL *string `json:"newPullRequestURL,omitempty"`
	// Compare this version to the target branch
	CompareURL *string `json:"compareURL,omitempty"`
}

// NewHistoricJobRepositoryURLs creates a new HistoricJobRepositoryURLs object.
func NewHistoricJobRepositoryURLs() *HistoricJobRepositoryURLs {
	return &HistoricJobRepositoryURLs{}
}

// OpenAPIModelName returns the OpenAPI model name for HistoricJobRepositoryURLs.
func (HistoricJobRepositoryURLs) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.HistoricJobRepositoryURLs"
}

// +k8s:openapi-gen=true
type HistoricJobStatus struct {
	State    *HistoricJobState `json:"state,omitempty"`
	Started  *int64            `json:"started,omitempty"`
	Finished *int64            `json:"finished,omitempty"`
	Message  *string           `json:"message,omitempty"`
	Errors   []string          `json:"errors,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
	// Optional value 0-100 that can be set while running
	Progress *float64 `json:"progress,omitempty"`
	// ProgressUpdates is the number of times the job's status has been written
	// while it was processed. It is carried over to the historic job so the total
	// number of progress updates a job went through remains observable after completion.
	ProgressUpdates *int64 `json:"progressUpdates,omitempty"`
	// Summary of processed actions
	Summary []HistoricJobResourceSummary `json:"summary,omitempty"`
	// URLs contains URLs for the reference branch or commit if applicable.
	Url *HistoricJobRepositoryURLs `json:"url,omitempty"`
}

// NewHistoricJobStatus creates a new HistoricJobStatus object.
func NewHistoricJobStatus() *HistoricJobStatus {
	return &HistoricJobStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for HistoricJobStatus.
func (HistoricJobStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.HistoricJobStatus"
}

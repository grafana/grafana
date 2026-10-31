// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type JobJobResourceSummary struct {
	Group   *string `json:"group,omitempty"`
	Kind    *string `json:"kind,omitempty"`
	Total   *int64  `json:"total,omitempty"`
	Create  *int64  `json:"create,omitempty"`
	Update  *int64  `json:"update,omitempty"`
	Delete  *int64  `json:"delete,omitempty"`
	Write   *int64  `json:"write,omitempty"`
	Error   *int64  `json:"error,omitempty"`
	Warning *int64  `json:"warning,omitempty"`
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

// NewJobJobResourceSummary creates a new JobJobResourceSummary object.
func NewJobJobResourceSummary() *JobJobResourceSummary {
	return &JobJobResourceSummary{}
}

// OpenAPIModelName returns the OpenAPI model name for JobJobResourceSummary.
func (JobJobResourceSummary) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobJobResourceSummary"
}

// +k8s:openapi-gen=true
type JobRepositoryURLs struct {
	// A URL pointing to the repository this lives in
	RepositoryURL *string `json:"repositoryURL,omitempty"`
	// A URL pointing to the file or ref in the repository
	SourceURL *string `json:"sourceURL,omitempty"`
	// A URL that will create a new pull request for this branch
	NewPullRequestURL *string `json:"newPullRequestURL,omitempty"`
	// Compare this version to the target branch
	CompareURL *string `json:"compareURL,omitempty"`
}

// NewJobRepositoryURLs creates a new JobRepositoryURLs object.
func NewJobRepositoryURLs() *JobRepositoryURLs {
	return &JobRepositoryURLs{}
}

// OpenAPIModelName returns the OpenAPI model name for JobRepositoryURLs.
func (JobRepositoryURLs) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobRepositoryURLs"
}

// +k8s:openapi-gen=true
type JobStatus struct {
	State    *JobStatusState `json:"state,omitempty"`
	Started  *int64          `json:"started,omitempty"`
	Finished *int64          `json:"finished,omitempty"`
	Message  *string         `json:"message,omitempty"`
	Errors   []string        `json:"errors,omitempty"`
	Warnings []string        `json:"warnings,omitempty"`
	// Optional value 0-100 that can be set while running
	Progress *float64 `json:"progress,omitempty"`
	// ProgressUpdates is the number of times the job's status has been written
	// while it was processed. It is carried over to the historic job so the total
	// number of progress updates a job went through remains observable after
	// completion.
	ProgressUpdates *int64 `json:"progressUpdates,omitempty"`
	// Summary of processed actions
	Summary []JobJobResourceSummary `json:"summary,omitempty"`
	// URLs contains URLs for the reference branch or commit if applicable.
	Url *JobRepositoryURLs `json:"url,omitempty"`
}

// NewJobStatus creates a new JobStatus object.
func NewJobStatus() *JobStatus {
	return &JobStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for JobStatus.
func (JobStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobStatus"
}

// +k8s:openapi-gen=true
type JobStatusState string

const (
	JobStatusStatePending JobStatusState = "pending"
	JobStatusStateWorking JobStatusState = "working"
	JobStatusStateSuccess JobStatusState = "success"
	JobStatusStateError   JobStatusState = "error"
	JobStatusStateWarning JobStatusState = "warning"
)

// OpenAPIModelName returns the OpenAPI model name for JobStatusState.
func (JobStatusState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobStatusState"
}

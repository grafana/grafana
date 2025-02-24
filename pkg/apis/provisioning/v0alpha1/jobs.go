package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// The repository name and type are stored as labels
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Job struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   JobSpec   `json:"spec,omitempty"`
	Status JobStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type JobList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Job `json:"items,omitempty"`
}

// +enum
type JobAction string

const (
	// Update a pull request -- send preview images, links etc
	JobActionPullRequest JobAction = "pr"

	// Sync the remote branch with the grafana instance
	JobActionSync JobAction = "sync"

	// Export from grafana into the remote repository
	JobActionExport JobAction = "export"
)

// +enum
type JobState string

const (
	// Job has been submitted, but not processed yet
	JobStatePending JobState = "pending"

	// The job is running
	JobStateWorking JobState = "working"

	// Finished with success
	JobStateSuccess JobState = "success"

	// Finished with errors
	JobStateError JobState = "error"
)

func (j JobState) Finished() bool {
	return j == JobStateSuccess || j == JobStateError
}

type JobSpec struct {
	Action JobAction `json:"action"`

	// The the repository reference (for now also in labels)
	Repository string `json:"repository"`

	// Pull request options
	PullRequest *PullRequestJobOptions `json:"pr,omitempty"`

	// Required when the action is `export`
	Export *ExportJobOptions `json:"export,omitempty"`

	// Required when the action is `sync`
	Sync *SyncJobOptions `json:"sync,omitempty"`
}

type PullRequestJobOptions struct {
	// The branch of commit hash
	Ref string `json:"ref,omitempty"`

	// Pull request number (when appropriate)
	PR   int    `json:"pr,omitempty"`
	Hash string `json:"hash,omitempty"` // used in PR code... not sure it is necessary

	// URL to the originator (eg, PR URL)
	URL string `json:"url,omitempty"`
}

type SyncJobOptions struct {
	// Incremental synchronization for versioned repositories
	Incremental bool `json:"incremental"`
}

type ExportJobOptions struct {
	// The source folder (or empty) to export
	Folder string `json:"folder,omitempty"`

	// Preserve history (if possible)
	History bool `json:"history,omitempty"`

	// Target branch for export (only git)
	Branch string `json:"branch,omitempty"`

	// Target file prefix
	Prefix string `json:"prefix,omitempty"`

	// Include the identifier in the exported metadata
	Identifier bool `json:"identifier"`
}

// The job status
type JobStatus struct {
	State    JobState `json:"state,omitempty"`
	Started  int64    `json:"started,omitempty"`
	Finished int64    `json:"finished,omitempty"`
	Message  string   `json:"message,omitempty"`
	Errors   []string `json:"errors,omitempty"`

	// Optional value 0-100 that can be set while running
	Progress float64 `json:"progress,omitempty"`

	// Summary of processed actions
	Summary []*JobResourceSummary `json:"summary,omitempty"`
}

type JobResourceSummary struct {
	Group    string `json:"group,omitempty"`
	Resource string `json:"resource,omitempty"`
	Total    int64  `json:"total,omitempty"` // the count (if known)

	Create int64 `json:"create,omitempty"`
	Update int64 `json:"update,omitempty"`
	Delete int64 `json:"delete,omitempty"`
	Write  int64 `json:"write,omitempty"` // Create or update (export)
	Error  int64 `json:"error,omitempty"` // The error count

	// No action required (useful for sync)
	Noop int64 `json:"noop,omitempty"`

	// Report errors for this resource type
	// This may not be an exhaustive list and recommend looking at the logs for more info
	Errors []string `json:"errors,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type WebhookResponse struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP Status code
	// 200 implies that the payload was understood but nothing is required
	// 202 implies that an async job has been scheduled to handle the request
	Code int `json:"code,omitempty"`

	// Optional message
	Message string `json:"added,omitempty"`

	// Jobs to be processed
	// When the response is 202 (Accepted) the queued jobs will be returned
	Job *JobSpec `json:"job,omitempty"`
}

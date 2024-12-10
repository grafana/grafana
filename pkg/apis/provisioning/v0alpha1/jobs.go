package v0alpha1

import (
	"path/filepath"

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

	// Merge the remote branch with the grafana instance
	JobActionMergeBranch JobAction = "merge"

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
	JobStateFinished JobState = "success"

	// Finished with errors
	JobStateError JobState = "error"
)

type JobSpec struct {
	Action JobAction `json:"action"`

	// The branch of commit hash
	Ref string `json:"ref,omitempty"`

	// Pull request number (when appropriate)
	PR   int    `json:"pr,omitempty"`
	Hash string `json:"hash,omitempty"` // used in PR code... not sure it is necessary

	// URL to the originator (eg, PR URL)
	URL string `json:"url,omitempty"`

	Added    []FileRef `json:"added,omitempty"`
	Modified []FileRef `json:"modified,omitempty"`
	Removed  []FileRef `json:"removed,omitempty"`
}

type FileRef struct {
	Ref  string `json:"ref"`
	Path string `json:"path"`
}

// The job status
type JobStatus struct {
	Updated metav1.Time `json:"updated,omitempty"`
	State   JobState    `json:"state,omitempty"`
	Message string      `json:"message,omitempty"`
	Errors  []string    `json:"errors,omitempty"`
}

// Filter ignorable files
type IgnoreFile = func(path string) bool

func IncludeYamlOrJSON(p string) bool { // put this somewhere better
	ext := filepath.Ext(p)
	if ext == ".yaml" || ext == ".json" {
		return false
	}
	return true
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type WebhookResponse struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP Status code
	Code int `json:"code,omitempty"`

	// Optional message
	Message string `json:"added,omitempty"`

	// Jobs to be processed
	Jobs []JobSpec `json:"jobs,omitempty"`

	// The queued jobs
	IDs []string `json:"ids,omitempty"`
}

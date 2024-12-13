package v0alpha1

import (
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// The repository name and type are stored as labels
// +genclient
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
	// Sync the remote branch with the grafana instance
	JobActionSync JobAction = "sync"

	// Update a pull request -- send preview images, links etc
	JobActionPullRequest JobAction = "pr"

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
}

// The job status
type JobStatus struct {
	State    JobState `json:"state,omitempty"`
	Started  int64    `json:"started,omitempty"`
	Finished int64    `json:"finished,omitempty"`
	Message  string   `json:"message,omitempty"`
	Errors   []string `json:"errors,omitempty"`

	// What did we do
	Actions []FileAction `json:"actions,omitempty"`
}

type FileAction struct {
	// add/modify/remove
	Action string `json:"action"`
	Path   string `json:"path,omitempty"`
	Ref    string `json:"ref,omitempty"`

	// An error/warning state
	Error string `json:"error,omitempty"`

	// Reference to the linked resource
	Group    string `json:"group,omitempty"`
	Version  string `json:"version,omitempty"`
	Resource string `json:"resource,omitempty"`
	Name     string `json:"name,omitempty"`

	// When there are too many actions, a summary will be included
	Count int `json:"count,omitempty"`
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
	// 200 implies that the payload was understood but nothing is required
	// 202 implies that an async job has been scheduled to handle the request
	Code int `json:"code,omitempty"`

	// Optional message
	Message string `json:"added,omitempty"`

	// Jobs to be processed
	// When the response is 202 (Accepted) the queued jobs will be returned
	Job *JobSpec `json:"job,omitempty"`
}

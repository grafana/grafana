// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1

// +k8s:openapi-gen=true
type FolderCascadeDeleteStatus struct {
	// Current phase of the cascade delete.
	State FolderCascadeDeleteStatusState `json:"state"`
	// Direct children discovered when the cascade started; the fixed denominator for remaining.
	Total *int64 `json:"total,omitempty"`
	// Direct children not yet deleted, recomputed on each reconcile.
	Remaining *int64 `json:"remaining,omitempty"`
	// Errors encountered while deleting direct children.
	Errors []string `json:"errors,omitempty"`
	// When the cascade started, in Unix milliseconds.
	Started *int64 `json:"started,omitempty"`
	// When the cascade reached a terminal state, in Unix milliseconds.
	Finished *int64 `json:"finished,omitempty"`
}

// NewFolderCascadeDeleteStatus creates a new FolderCascadeDeleteStatus object.
func NewFolderCascadeDeleteStatus() *FolderCascadeDeleteStatus {
	return &FolderCascadeDeleteStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderCascadeDeleteStatus.
func (FolderCascadeDeleteStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1.FolderCascadeDeleteStatus"
}

// +k8s:openapi-gen=true
type FolderStatus struct {
	// Progress of a finalizer-driven cascade delete. Absent until deletion starts.
	CascadeDelete *FolderCascadeDeleteStatus `json:"cascadeDelete,omitempty"`
}

// NewFolderStatus creates a new FolderStatus object.
func NewFolderStatus() *FolderStatus {
	return &FolderStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderStatus.
func (FolderStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1.FolderStatus"
}

// +k8s:openapi-gen=true
type FolderCascadeDeleteStatusState string

const (
	FolderCascadeDeleteStatusStateNone       FolderCascadeDeleteStatusState = ""
	FolderCascadeDeleteStatusStatePending    FolderCascadeDeleteStatusState = "Pending"
	FolderCascadeDeleteStatusStateInProgress FolderCascadeDeleteStatusState = "InProgress"
	FolderCascadeDeleteStatusStateCompleted  FolderCascadeDeleteStatusState = "Completed"
	FolderCascadeDeleteStatusStateFailed     FolderCascadeDeleteStatusState = "Failed"
)

// OpenAPIModelName returns the OpenAPI model name for FolderCascadeDeleteStatusState.
func (FolderCascadeDeleteStatusState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1.FolderCascadeDeleteStatusState"
}

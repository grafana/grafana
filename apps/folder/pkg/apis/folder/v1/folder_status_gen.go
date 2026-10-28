// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1

// +k8s:openapi-gen=true
type FolderCascadeDeleteStatus struct {
	// state is the current phase of the cascade-delete operation.
	State FolderCascadeDeleteStatusState `json:"state"`
	// total is the count of resources discovered under this folder when the
	// cascade-delete operation started. Needed to make remaining (and any
	// progress percentage a client derives from it) meaningful, since it's
	// the fixed denominator both are measured against.
	Total *int64 `json:"total,omitempty"`
	// remaining is the count of resources not yet deleted.
	Remaining *int64 `json:"remaining,omitempty"`
	// errors lists the errors encountered while deleting resources.
	Errors []string `json:"errors,omitempty"`
	// started is when the cascade-delete operation began (Unix milliseconds).
	Started *int64 `json:"started,omitempty"`
	// finished is when the cascade-delete operation completed (Unix milliseconds).
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
	// cascadeDelete reports the progress of an in-flight cascade deletion of this
	// folder, driven by the folder controller via the CascadeDeleteFinalizer.
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

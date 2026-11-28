// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type PendingFolderDeletionSpec struct {
	// Folder metadata.name: the legacy Grafana folder UID, not the display title.
	FolderName string `json:"folderName"`
	// Folder Kubernetes metadata.uid identifies this incarnation; appended to folderName with a hyphen for pending metadata.name.
	FolderUID string `json:"folderUID"`
	// Captured from the folder's deletionTimestamp to measure actual deletion duration.
	// The entry's metadata.creationTimestamp records intent before deletion is attempted;
	// a failed or timed-out request may leave intent without starting deletion.
	// Using that creation time would include the wait before deletion begins.
	// Optional because the folder's deletion timestamp is not yet known when intent is recorded.
	DeletionTimestamp *string `json:"deletionTimestamp,omitempty"`
}

// NewPendingFolderDeletionSpec creates a new PendingFolderDeletionSpec object.
func NewPendingFolderDeletionSpec() *PendingFolderDeletionSpec {
	return &PendingFolderDeletionSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for PendingFolderDeletionSpec.
func (PendingFolderDeletionSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1alpha1.PendingFolderDeletionSpec"
}

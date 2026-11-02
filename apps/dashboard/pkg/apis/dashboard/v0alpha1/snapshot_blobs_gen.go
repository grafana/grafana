// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type SnapshotBlobReference struct {
	Uid         string  `json:"uid"`
	Size        *int64  `json:"size,omitempty"`
	Hash        *string `json:"hash,omitempty"`
	ContentType *string `json:"contentType,omitempty"`
}

// NewSnapshotBlobReference creates a new SnapshotBlobReference object.
func NewSnapshotBlobReference() *SnapshotBlobReference {
	return &SnapshotBlobReference{}
}

// OpenAPIModelName returns the OpenAPI model name for SnapshotBlobReference.
func (SnapshotBlobReference) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v0alpha1.SnapshotBlobReference"
}

// +k8s:openapi-gen=true
type SnapshotBlobs struct {
	Dashboard *SnapshotBlobReference `json:"dashboard,omitempty"`
}

// NewSnapshotBlobs creates a new SnapshotBlobs object.
func NewSnapshotBlobs() *SnapshotBlobs {
	return &SnapshotBlobs{}
}

// OpenAPIModelName returns the OpenAPI model name for SnapshotBlobs.
func (SnapshotBlobs) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v0alpha1.SnapshotBlobs"
}

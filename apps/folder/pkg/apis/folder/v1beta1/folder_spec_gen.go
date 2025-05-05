// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type FolderSpec struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
}

// NewFolderSpec creates a new FolderSpec object.
func NewFolderSpec() *FolderSpec {
	return &FolderSpec{}
}

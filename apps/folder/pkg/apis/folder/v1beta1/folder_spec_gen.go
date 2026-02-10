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
func (FolderSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1beta1.FolderSpec"
}

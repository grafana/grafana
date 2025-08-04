// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ShortURLSpec struct {
	// The original path to where the short url is linking too e.g. https://localhost:3000/eer8i1kictngga/new-dashboard-with-lib-panel
	Path string `json:"path"`
}

// NewShortURLSpec creates a new ShortURLSpec object.
func NewShortURLSpec() *ShortURLSpec {
	return &ShortURLSpec{}
}

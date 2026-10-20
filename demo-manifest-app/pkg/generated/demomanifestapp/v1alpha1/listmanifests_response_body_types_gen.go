// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ListManifestsBody struct {
	Manifests []interface{} `json:"manifests"`
	Continue  string        `json:"continue"`
}

// NewListManifestsBody creates a new ListManifestsBody object.
func NewListManifestsBody() *ListManifestsBody {
	return &ListManifestsBody{
		Manifests: []interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListManifestsBody.
func (ListManifestsBody) OpenAPIModelName() string {
	return "com.github.demo.manifest.pkg.generated.v1alpha1.ListManifestsBody"
}

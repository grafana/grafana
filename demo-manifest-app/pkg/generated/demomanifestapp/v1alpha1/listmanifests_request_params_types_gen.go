// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

type ListManifestsRequestParams struct {
	Limit    *int64  `json:"limit,omitempty"`
	Continue *string `json:"continue,omitempty"`
}

// NewListManifestsRequestParams creates a new ListManifestsRequestParams object.
func NewListManifestsRequestParams() *ListManifestsRequestParams {
	return &ListManifestsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for ListManifestsRequestParams.
func (ListManifestsRequestParams) OpenAPIModelName() string {
	return "com.github.demo.manifest.pkg.generated.v1alpha1.ListManifestsRequestParams"
}

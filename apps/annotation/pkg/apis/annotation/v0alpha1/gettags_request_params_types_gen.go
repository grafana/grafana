// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetTagsRequestParams struct {
	// Return tags that start with this value.
	Prefix *string `json:"prefix,omitempty"`
	// Return tags that contain this value.
	Contains *string `json:"contains,omitempty"`
	// Maximum number of tags to return. Defaults to 100.
	Limit *int64 `json:"limit,omitempty"`
}

// NewGetTagsRequestParams creates a new GetTagsRequestParams object.
func NewGetTagsRequestParams() *GetTagsRequestParams {
	return &GetTagsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTagsRequestParams.
func (GetTagsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsRequestParams"
}

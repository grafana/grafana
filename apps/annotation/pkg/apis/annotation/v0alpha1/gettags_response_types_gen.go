// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTagsResponse struct {
	// List of unique tags and their counts.
	Tags []GetTagsV0alpha1ResponseTags `json:"tags"`
}

// NewGetTagsResponse creates a new GetTagsResponse object.
func NewGetTagsResponse() *GetTagsResponse {
	return &GetTagsResponse{
		Tags: []GetTagsV0alpha1ResponseTags{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTagsResponse.
func (GetTagsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsResponse"
}

// +k8s:openapi-gen=true
type GetTagsV0alpha1ResponseTags struct {
	// Tag value.
	Tag string `json:"tag"`
	// Count of annotations with this tag.
	Count int64 `json:"count"`
}

// NewGetTagsV0alpha1ResponseTags creates a new GetTagsV0alpha1ResponseTags object.
func NewGetTagsV0alpha1ResponseTags() *GetTagsV0alpha1ResponseTags {
	return &GetTagsV0alpha1ResponseTags{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTagsV0alpha1ResponseTags.
func (GetTagsV0alpha1ResponseTags) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsV0alpha1ResponseTags"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTagsBody struct {
	Tags []GetTagsV0alpha1BodyTags `json:"tags"`
}

// NewGetTagsBody creates a new GetTagsBody object.
func NewGetTagsBody() *GetTagsBody {
	return &GetTagsBody{
		Tags: []GetTagsV0alpha1BodyTags{},
	}
}

// +k8s:openapi-gen=true
type GetTagsV0alpha1BodyTags struct {
	Tag   string  `json:"tag"`
	Count float64 `json:"count"`
}

// NewGetTagsV0alpha1BodyTags creates a new GetTagsV0alpha1BodyTags object.
func NewGetTagsV0alpha1BodyTags() *GetTagsV0alpha1BodyTags {
	return &GetTagsV0alpha1BodyTags{}
}
func (GetTagsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsBody"
}
func (GetTagsV0alpha1BodyTags) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsV0alpha1BodyTags"
}

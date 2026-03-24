// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetAnnotationTagsBody struct {
	Tags []GetAnnotationTagsV0alpha1BodyTags `json:"tags"`
}

// NewGetAnnotationTagsBody creates a new GetAnnotationTagsBody object.
func NewGetAnnotationTagsBody() *GetAnnotationTagsBody {
	return &GetAnnotationTagsBody{
		Tags: []GetAnnotationTagsV0alpha1BodyTags{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetAnnotationTagsBody.
func (GetAnnotationTagsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetAnnotationTagsBody"
}

// +k8s:openapi-gen=true
type GetAnnotationTagsV0alpha1BodyTags struct {
	Tag   string  `json:"tag"`
	Count float64 `json:"count"`
}

// NewGetAnnotationTagsV0alpha1BodyTags creates a new GetAnnotationTagsV0alpha1BodyTags object.
func NewGetAnnotationTagsV0alpha1BodyTags() *GetAnnotationTagsV0alpha1BodyTags {
	return &GetAnnotationTagsV0alpha1BodyTags{}
}

// OpenAPIModelName returns the OpenAPI model name for GetAnnotationTagsV0alpha1BodyTags.
func (GetAnnotationTagsV0alpha1BodyTags) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetAnnotationTagsV0alpha1BodyTags"
}

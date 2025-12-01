// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTagsBody struct {
	Tags []V0alpha1GetTagsBodyTags `json:"tags"`
}

// NewGetTagsBody creates a new GetTagsBody object.
func NewGetTagsBody() *GetTagsBody {
	return &GetTagsBody{
		Tags: []V0alpha1GetTagsBodyTags{},
	}
}

// +k8s:openapi-gen=true
type V0alpha1GetTagsBodyTags struct {
	Tag   string  `json:"tag"`
	Count float64 `json:"count"`
}

// NewV0alpha1GetTagsBodyTags creates a new V0alpha1GetTagsBodyTags object.
func NewV0alpha1GetTagsBodyTags() *V0alpha1GetTagsBodyTags {
	return &V0alpha1GetTagsBodyTags{}
}

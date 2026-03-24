// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetAnnotationTagsResponse struct {
	metav1.TypeMeta       `json:",inline"`
	GetAnnotationTagsBody `json:",inline"`
}

func NewGetAnnotationTagsResponse() *GetAnnotationTagsResponse {
	return &GetAnnotationTagsResponse{}
}

func (t *GetAnnotationTagsBody) DeepCopyInto(dst *GetAnnotationTagsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetAnnotationTagsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetAnnotationTagsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetAnnotationTagsResponse) DeepCopyInto(dst *GetAnnotationTagsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetAnnotationTagsBody.DeepCopyInto(&dst.GetAnnotationTagsBody)
}

func (GetAnnotationTagsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetAnnotationTagsResponse"
}

var _ runtime.Object = NewGetAnnotationTagsResponse()

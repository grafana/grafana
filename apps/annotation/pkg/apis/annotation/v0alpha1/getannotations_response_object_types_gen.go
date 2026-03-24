// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetAnnotationsResponse struct {
	metav1.TypeMeta    `json:",inline"`
	GetAnnotationsBody `json:",inline"`
}

func NewGetAnnotationsResponse() *GetAnnotationsResponse {
	return &GetAnnotationsResponse{}
}

func (t *GetAnnotationsBody) DeepCopyInto(dst *GetAnnotationsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetAnnotationsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetAnnotationsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetAnnotationsResponse) DeepCopyInto(dst *GetAnnotationsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetAnnotationsBody.DeepCopyInto(&dst.GetAnnotationsBody)
}

func (GetAnnotationsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetAnnotationsResponse"
}

var _ runtime.Object = NewGetAnnotationsResponse()

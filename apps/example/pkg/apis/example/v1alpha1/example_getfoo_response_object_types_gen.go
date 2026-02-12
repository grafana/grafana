// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetFooResponse struct {
	metav1.TypeMeta `json:",inline"`
	GetFooBody      `json:",inline"`
}

func NewGetFooResponse() *GetFooResponse {
	return &GetFooResponse{}
}

func (t *GetFooBody) DeepCopyInto(dst *GetFooBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetFooResponse) DeepCopyObject() runtime.Object {
	dst := NewGetFooResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetFooResponse) DeepCopyInto(dst *GetFooResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetFooBody.DeepCopyInto(&dst.GetFooBody)
}

func (GetFooResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v1alpha1.GetFooResponse"
}

var _ runtime.Object = NewGetFooResponse()

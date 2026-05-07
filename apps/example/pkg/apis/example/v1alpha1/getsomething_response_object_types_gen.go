// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSomethingResponse struct {
	metav1.TypeMeta  `json:",inline"`
	GetSomethingBody `json:",inline"`
}

func NewGetSomethingResponse() *GetSomethingResponse {
	return &GetSomethingResponse{}
}

func (t *GetSomethingBody) DeepCopyInto(dst *GetSomethingBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSomethingResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSomethingResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSomethingResponse) DeepCopyInto(dst *GetSomethingResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSomethingBody.DeepCopyInto(&dst.GetSomethingBody)
}

func (GetSomethingResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v1alpha1.GetSomethingResponse"
}

var _ runtime.Object = NewGetSomethingResponse()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateGraphiteResponse struct {
	metav1.TypeMeta    `json:",inline"`
	metav1.ObjectMeta  `json:"metadata"`
	CreateGraphiteBody `json:",inline"`
}

func NewCreateGraphiteResponse() *CreateGraphiteResponse {
	return &CreateGraphiteResponse{}
}

func (t *CreateGraphiteBody) DeepCopyInto(dst *CreateGraphiteBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateGraphiteResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateGraphiteResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateGraphiteResponse) DeepCopyInto(dst *CreateGraphiteResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ObjectMeta.DeepCopyInto(&dst.ObjectMeta)
	o.CreateGraphiteBody.DeepCopyInto(&dst.CreateGraphiteBody)
}

func (CreateGraphiteResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.CreateGraphiteResponse"
}

var _ runtime.Object = NewCreateGraphiteResponse()

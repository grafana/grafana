// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSomething struct {
	metav1.TypeMeta  `json:",inline"`
	GetSomethingBody `json:",inline"`
}

func NewGetSomething() *GetSomething {
	return &GetSomething{}
}

func (t *GetSomethingBody) DeepCopyInto(dst *GetSomethingBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSomething) DeepCopyObject() runtime.Object {
	dst := NewGetSomething()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSomething) DeepCopyInto(dst *GetSomething) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSomethingBody.DeepCopyInto(&dst.GetSomethingBody)
}

var _ runtime.Object = NewGetSomething()

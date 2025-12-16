// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetFoo struct {
	metav1.TypeMeta `json:",inline"`
	GetFooBody      `json:",inline"`
}

func NewGetFoo() *GetFoo {
	return &GetFoo{}
}

func (t *GetFooBody) DeepCopyInto(dst *GetFooBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetFoo) DeepCopyObject() runtime.Object {
	dst := NewGetFoo()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetFoo) DeepCopyInto(dst *GetFoo) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetFooBody.DeepCopyInto(&dst.GetFooBody)
}

var _ runtime.Object = NewGetFoo()

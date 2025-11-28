// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetUsage struct {
	metav1.TypeMeta `json:",inline"`
	GetUsageBody    `json:",inline"`
}

func NewGetUsage() *GetUsage {
	return &GetUsage{}
}

func (t *GetUsageBody) DeepCopyInto(dst *GetUsageBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetUsage) DeepCopyObject() runtime.Object {
	dst := NewGetUsage()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetUsage) DeepCopyInto(dst *GetUsage) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetUsageBody.DeepCopyInto(&dst.GetUsageBody)
}

var _ runtime.Object = NewGetUsage()

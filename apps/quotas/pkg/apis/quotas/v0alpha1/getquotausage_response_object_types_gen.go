// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetQuotaUsage struct {
	metav1.TypeMeta   `json:",inline"`
	GetQuotaUsageBody `json:",inline"`
}

func NewGetQuotaUsage() *GetQuotaUsage {
	return &GetQuotaUsage{}
}

func (t *GetQuotaUsageBody) DeepCopyInto(dst *GetQuotaUsageBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetQuotaUsage) DeepCopyObject() runtime.Object {
	dst := NewGetQuotaUsage()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetQuotaUsage) DeepCopyInto(dst *GetQuotaUsage) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetQuotaUsageBody.DeepCopyInto(&dst.GetQuotaUsageBody)
}

var _ runtime.Object = NewGetQuotaUsage()

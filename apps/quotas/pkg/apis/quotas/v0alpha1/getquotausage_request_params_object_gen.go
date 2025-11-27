// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetQuotaUsageRequestParamsObject struct {
	metav1.TypeMeta            `json:",inline"`
	GetQuotaUsageRequestParams `json:",inline"`
}

func NewGetQuotaUsageRequestParamsObject() *GetQuotaUsageRequestParamsObject {
	return &GetQuotaUsageRequestParamsObject{}
}

func (o *GetQuotaUsageRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetQuotaUsageRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetQuotaUsageRequestParamsObject) DeepCopyInto(dst *GetQuotaUsageRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetQuotaUsageRequestParams := GetQuotaUsageRequestParams{}
	_ = resource.CopyObjectInto(&dstGetQuotaUsageRequestParams, &o.GetQuotaUsageRequestParams)
}

var _ runtime.Object = NewGetQuotaUsageRequestParamsObject()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetQuotasRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    GetQuotasRequestParams `json:",inline"`
}

func NewGetQuotasRequestParamsObject() *GetQuotasRequestParamsObject {
    return &GetQuotasRequestParamsObject{}
}

func (o *GetQuotasRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewGetQuotasRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *GetQuotasRequestParamsObject) DeepCopyInto(dst *GetQuotasRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstGetQuotasRequestParams := GetQuotasRequestParams{}
    _ = resource.CopyObjectInto(&dstGetQuotasRequestParams, &o.GetQuotasRequestParams)
}

var _ runtime.Object = NewGetQuotasRequestParamsObject()
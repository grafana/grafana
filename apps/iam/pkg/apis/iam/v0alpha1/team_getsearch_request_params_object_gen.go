// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    GetSearchRequestParams `json:",inline"`
}

func NewGetSearchRequestParamsObject() *GetSearchRequestParamsObject {
    return &GetSearchRequestParamsObject{}
}

func (o *GetSearchRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewGetSearchRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *GetSearchRequestParamsObject) DeepCopyInto(dst *GetSearchRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstGetSearchRequestParams := GetSearchRequestParams{}
    _ = resource.CopyObjectInto(&dstGetSearchRequestParams, &o.GetSearchRequestParams)
}

var _ runtime.Object = NewGetSearchRequestParamsObject()
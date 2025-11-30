// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchUserRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    GetSearchUserRequestParams `json:",inline"`
}

func NewGetSearchUserRequestParamsObject() *GetSearchUserRequestParamsObject {
    return &GetSearchUserRequestParamsObject{}
}

func (o *GetSearchUserRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewGetSearchUserRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *GetSearchUserRequestParamsObject) DeepCopyInto(dst *GetSearchUserRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstGetSearchUserRequestParams := GetSearchUserRequestParams{}
    _ = resource.CopyObjectInto(&dstGetSearchUserRequestParams, &o.GetSearchUserRequestParams)
}

var _ runtime.Object = NewGetSearchUserRequestParamsObject()
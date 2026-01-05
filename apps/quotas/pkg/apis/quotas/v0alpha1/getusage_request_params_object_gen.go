// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetUsageRequestParamsObject struct {
	metav1.TypeMeta       `json:",inline"`
	GetUsageRequestParams `json:",inline"`
}

func NewGetUsageRequestParamsObject() *GetUsageRequestParamsObject {
	return &GetUsageRequestParamsObject{}
}

func (o *GetUsageRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetUsageRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetUsageRequestParamsObject) DeepCopyInto(dst *GetUsageRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetUsageRequestParams := GetUsageRequestParams{}
	_ = resource.CopyObjectInto(&dstGetUsageRequestParams, &o.GetUsageRequestParams)
}

var _ runtime.Object = NewGetUsageRequestParamsObject()

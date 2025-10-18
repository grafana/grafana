// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetOtherRequestParamsObject struct {
	metav1.TypeMeta       `json:",inline"`
	GetOtherRequestParams `json:",inline"`
}

func NewGetOtherRequestParamsObject() *GetOtherRequestParamsObject {
	return &GetOtherRequestParamsObject{}
}

func (o *GetOtherRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetOtherRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetOtherRequestParamsObject) DeepCopyInto(dst *GetOtherRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetOtherRequestParams := GetOtherRequestParams{}
	_ = resource.CopyObjectInto(&dstGetOtherRequestParams, &o.GetOtherRequestParams)
}

var _ runtime.Object = NewGetOtherRequestParamsObject()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetFooRequestParamsObject struct {
	metav1.TypeMeta     `json:",inline"`
	GetFooRequestParams `json:",inline"`
}

func NewGetFooRequestParamsObject() *GetFooRequestParamsObject {
	return &GetFooRequestParamsObject{}
}

func (o *GetFooRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetFooRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetFooRequestParamsObject) DeepCopyInto(dst *GetFooRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetFooRequestParams := GetFooRequestParams{}
	_ = resource.CopyObjectInto(&dstGetFooRequestParams, &o.GetFooRequestParams)
}

var _ runtime.Object = NewGetFooRequestParamsObject()

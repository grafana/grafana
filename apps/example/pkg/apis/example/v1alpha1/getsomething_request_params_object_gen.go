// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSomethingRequestParamsObject struct {
	metav1.TypeMeta           `json:",inline"`
	GetSomethingRequestParams `json:",inline"`
}

func NewGetSomethingRequestParamsObject() *GetSomethingRequestParamsObject {
	return &GetSomethingRequestParamsObject{}
}

func (o *GetSomethingRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSomethingRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSomethingRequestParamsObject) DeepCopyInto(dst *GetSomethingRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSomethingRequestParams := GetSomethingRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSomethingRequestParams, &o.GetSomethingRequestParams)
}

var _ runtime.Object = NewGetSomethingRequestParamsObject()

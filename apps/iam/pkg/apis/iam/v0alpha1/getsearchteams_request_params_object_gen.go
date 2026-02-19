// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchTeamsRequestParamsObject struct {
	metav1.TypeMeta             `json:",inline"`
	GetSearchTeamsRequestParams `json:",inline"`
}

func NewGetSearchTeamsRequestParamsObject() *GetSearchTeamsRequestParamsObject {
	return &GetSearchTeamsRequestParamsObject{}
}

func (o *GetSearchTeamsRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSearchTeamsRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchTeamsRequestParamsObject) DeepCopyInto(dst *GetSearchTeamsRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSearchTeamsRequestParams := GetSearchTeamsRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSearchTeamsRequestParams, &o.GetSearchTeamsRequestParams)
}

var _ runtime.Object = NewGetSearchTeamsRequestParamsObject()

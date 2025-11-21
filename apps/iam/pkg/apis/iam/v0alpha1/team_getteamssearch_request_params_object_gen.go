// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetTeamssearchRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    GetTeamssearchRequestParams `json:",inline"`
}

func NewGetTeamssearchRequestParamsObject() *GetTeamssearchRequestParamsObject {
    return &GetTeamssearchRequestParamsObject{}
}

func (o *GetTeamssearchRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewGetTeamssearchRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *GetTeamssearchRequestParamsObject) DeepCopyInto(dst *GetTeamssearchRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstGetTeamssearchRequestParams := GetTeamssearchRequestParams{}
    _ = resource.CopyObjectInto(&dstGetTeamssearchRequestParams, &o.GetTeamssearchRequestParams)
}

var _ runtime.Object = NewGetTeamssearchRequestParamsObject()
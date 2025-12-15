// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchUsersRequestParamsObject struct {
	metav1.TypeMeta             `json:",inline"`
	GetSearchUsersRequestParams `json:",inline"`
}

func NewGetSearchUsersRequestParamsObject() *GetSearchUsersRequestParamsObject {
	return &GetSearchUsersRequestParamsObject{}
}

func (o *GetSearchUsersRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSearchUsersRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchUsersRequestParamsObject) DeepCopyInto(dst *GetSearchUsersRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSearchUsersRequestParams := GetSearchUsersRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSearchUsersRequestParams, &o.GetSearchUsersRequestParams)
}

var _ runtime.Object = NewGetSearchUsersRequestParamsObject()

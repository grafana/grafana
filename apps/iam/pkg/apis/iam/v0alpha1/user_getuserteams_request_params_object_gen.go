// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetUserTeamsRequestParamsObject struct {
	metav1.TypeMeta           `json:",inline"`
	GetUserTeamsRequestParams `json:",inline"`
}

func NewGetUserTeamsRequestParamsObject() *GetUserTeamsRequestParamsObject {
	return &GetUserTeamsRequestParamsObject{}
}

func (o *GetUserTeamsRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetUserTeamsRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetUserTeamsRequestParamsObject) DeepCopyInto(dst *GetUserTeamsRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetUserTeamsRequestParams := GetUserTeamsRequestParams{}
	_ = resource.CopyObjectInto(&dstGetUserTeamsRequestParams, &o.GetUserTeamsRequestParams)
}

func (GetUserTeamsRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetUserTeamsRequestParamsObject"
}

var _ runtime.Object = NewGetUserTeamsRequestParamsObject()

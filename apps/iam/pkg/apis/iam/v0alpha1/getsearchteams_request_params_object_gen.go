// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
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

func (GetSearchTeamsRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchTeamsRequestParamsObject"
}

var _ runtime.Object = NewGetSearchTeamsRequestParamsObject()

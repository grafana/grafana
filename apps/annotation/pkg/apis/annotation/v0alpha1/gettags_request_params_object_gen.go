// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetTagsRequestParamsObject struct {
	metav1.TypeMeta      `json:",inline"`
	GetTagsRequestParams `json:",inline"`
}

func NewGetTagsRequestParamsObject() *GetTagsRequestParamsObject {
	return &GetTagsRequestParamsObject{}
}

func (o *GetTagsRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetTagsRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTagsRequestParamsObject) DeepCopyInto(dst *GetTagsRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetTagsRequestParams := GetTagsRequestParams{}
	_ = resource.CopyObjectInto(&dstGetTagsRequestParams, &o.GetTagsRequestParams)
}

func (GetTagsRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetTagsRequestParamsObject"
}

var _ runtime.Object = NewGetTagsRequestParamsObject()

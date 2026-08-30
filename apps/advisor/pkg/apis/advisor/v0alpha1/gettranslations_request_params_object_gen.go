// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetTranslationsRequestParamsObject struct {
	metav1.TypeMeta              `json:",inline"`
	GetTranslationsRequestParams `json:",inline"`
}

func NewGetTranslationsRequestParamsObject() *GetTranslationsRequestParamsObject {
	return &GetTranslationsRequestParamsObject{}
}

func (o *GetTranslationsRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetTranslationsRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTranslationsRequestParamsObject) DeepCopyInto(dst *GetTranslationsRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetTranslationsRequestParams := GetTranslationsRequestParams{}
	_ = resource.CopyObjectInto(&dstGetTranslationsRequestParams, &o.GetTranslationsRequestParams)
}

func (GetTranslationsRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.GetTranslationsRequestParamsObject"
}

var _ runtime.Object = NewGetTranslationsRequestParamsObject()

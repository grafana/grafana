// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchRulesRequestParamsObject struct {
	metav1.TypeMeta             `json:",inline"`
	GetSearchRulesRequestParams `json:",inline"`
}

func NewGetSearchRulesRequestParamsObject() *GetSearchRulesRequestParamsObject {
	return &GetSearchRulesRequestParamsObject{}
}

func (o *GetSearchRulesRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSearchRulesRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchRulesRequestParamsObject) DeepCopyInto(dst *GetSearchRulesRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSearchRulesRequestParams := GetSearchRulesRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSearchRulesRequestParams, &o.GetSearchRulesRequestParams)
}

func (GetSearchRulesRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRequestParamsObject"
}

var _ runtime.Object = NewGetSearchRulesRequestParamsObject()

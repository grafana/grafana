// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchAlertRulesRequestParamsObject struct {
	metav1.TypeMeta                  `json:",inline"`
	GetSearchAlertRulesRequestParams `json:",inline"`
}

func NewGetSearchAlertRulesRequestParamsObject() *GetSearchAlertRulesRequestParamsObject {
	return &GetSearchAlertRulesRequestParamsObject{}
}

func (o *GetSearchAlertRulesRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSearchAlertRulesRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchAlertRulesRequestParamsObject) DeepCopyInto(dst *GetSearchAlertRulesRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSearchAlertRulesRequestParams := GetSearchAlertRulesRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSearchAlertRulesRequestParams, &o.GetSearchAlertRulesRequestParams)
}

func (GetSearchAlertRulesRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRequestParamsObject"
}

var _ runtime.Object = NewGetSearchAlertRulesRequestParamsObject()

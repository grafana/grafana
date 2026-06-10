// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetSearchRecordingRulesRequestParamsObject struct {
	metav1.TypeMeta                      `json:",inline"`
	GetSearchRecordingRulesRequestParams `json:",inline"`
}

func NewGetSearchRecordingRulesRequestParamsObject() *GetSearchRecordingRulesRequestParamsObject {
	return &GetSearchRecordingRulesRequestParamsObject{}
}

func (o *GetSearchRecordingRulesRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewGetSearchRecordingRulesRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchRecordingRulesRequestParamsObject) DeepCopyInto(dst *GetSearchRecordingRulesRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstGetSearchRecordingRulesRequestParams := GetSearchRecordingRulesRequestParams{}
	_ = resource.CopyObjectInto(&dstGetSearchRecordingRulesRequestParams, &o.GetSearchRecordingRulesRequestParams)
}

func (GetSearchRecordingRulesRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRequestParamsObject"
}

var _ runtime.Object = NewGetSearchRecordingRulesRequestParamsObject()

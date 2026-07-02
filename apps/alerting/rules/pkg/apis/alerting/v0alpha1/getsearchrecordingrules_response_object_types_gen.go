// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchRecordingRulesResponse struct {
	metav1.TypeMeta             `json:",inline"`
	metav1.ListMeta             `json:"metadata"`
	GetSearchRecordingRulesBody `json:",inline"`
}

func NewGetSearchRecordingRulesResponse() *GetSearchRecordingRulesResponse {
	return &GetSearchRecordingRulesResponse{}
}

func (t *GetSearchRecordingRulesBody) DeepCopyInto(dst *GetSearchRecordingRulesBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchRecordingRulesResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSearchRecordingRulesResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchRecordingRulesResponse) DeepCopyInto(dst *GetSearchRecordingRulesResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListMeta.DeepCopyInto(&dst.ListMeta)
	o.GetSearchRecordingRulesBody.DeepCopyInto(&dst.GetSearchRecordingRulesBody)
}

func (GetSearchRecordingRulesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesResponse"
}

var _ runtime.Object = NewGetSearchRecordingRulesResponse()

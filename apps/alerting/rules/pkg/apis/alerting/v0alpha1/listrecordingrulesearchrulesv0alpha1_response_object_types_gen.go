// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1Response struct {
	metav1.TypeMeta                          `json:",inline"`
	ListRecordingRuleSearchRulesV0alpha1Body `json:",inline"`
}

func NewListRecordingRuleSearchRulesV0alpha1Response() *ListRecordingRuleSearchRulesV0alpha1Response {
	return &ListRecordingRuleSearchRulesV0alpha1Response{}
}

func (t *ListRecordingRuleSearchRulesV0alpha1Body) DeepCopyInto(dst *ListRecordingRuleSearchRulesV0alpha1Body) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListRecordingRuleSearchRulesV0alpha1Response) DeepCopyObject() runtime.Object {
	dst := NewListRecordingRuleSearchRulesV0alpha1Response()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListRecordingRuleSearchRulesV0alpha1Response) DeepCopyInto(dst *ListRecordingRuleSearchRulesV0alpha1Response) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListRecordingRuleSearchRulesV0alpha1Body.DeepCopyInto(&dst.ListRecordingRuleSearchRulesV0alpha1Body)
}

func (ListRecordingRuleSearchRulesV0alpha1Response) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1Response"
}

var _ runtime.Object = NewListRecordingRuleSearchRulesV0alpha1Response()

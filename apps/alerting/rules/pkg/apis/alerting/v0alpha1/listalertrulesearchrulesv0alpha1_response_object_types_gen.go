// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1Response struct {
	metav1.TypeMeta                      `json:",inline"`
	ListAlertRuleSearchRulesV0alpha1Body `json:",inline"`
}

func NewListAlertRuleSearchRulesV0alpha1Response() *ListAlertRuleSearchRulesV0alpha1Response {
	return &ListAlertRuleSearchRulesV0alpha1Response{}
}

func (t *ListAlertRuleSearchRulesV0alpha1Body) DeepCopyInto(dst *ListAlertRuleSearchRulesV0alpha1Body) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListAlertRuleSearchRulesV0alpha1Response) DeepCopyObject() runtime.Object {
	dst := NewListAlertRuleSearchRulesV0alpha1Response()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListAlertRuleSearchRulesV0alpha1Response) DeepCopyInto(dst *ListAlertRuleSearchRulesV0alpha1Response) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListAlertRuleSearchRulesV0alpha1Body.DeepCopyInto(&dst.ListAlertRuleSearchRulesV0alpha1Body)
}

func (ListAlertRuleSearchRulesV0alpha1Response) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1Response"
}

var _ runtime.Object = NewListAlertRuleSearchRulesV0alpha1Response()

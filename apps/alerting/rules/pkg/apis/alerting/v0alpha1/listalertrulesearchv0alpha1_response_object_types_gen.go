// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListAlertRuleSearchV0alpha1Response struct {
	metav1.TypeMeta                 `json:",inline"`
	ListAlertRuleSearchV0alpha1Body `json:",inline"`
}

func NewListAlertRuleSearchV0alpha1Response() *ListAlertRuleSearchV0alpha1Response {
	return &ListAlertRuleSearchV0alpha1Response{}
}

func (t *ListAlertRuleSearchV0alpha1Body) DeepCopyInto(dst *ListAlertRuleSearchV0alpha1Body) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListAlertRuleSearchV0alpha1Response) DeepCopyObject() runtime.Object {
	dst := NewListAlertRuleSearchV0alpha1Response()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListAlertRuleSearchV0alpha1Response) DeepCopyInto(dst *ListAlertRuleSearchV0alpha1Response) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListAlertRuleSearchV0alpha1Body.DeepCopyInto(&dst.ListAlertRuleSearchV0alpha1Body)
}

func (ListAlertRuleSearchV0alpha1Response) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1Response"
}

var _ runtime.Object = NewListAlertRuleSearchV0alpha1Response()

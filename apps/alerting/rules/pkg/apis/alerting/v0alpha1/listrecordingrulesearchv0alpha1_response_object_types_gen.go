// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1Response struct {
	metav1.TypeMeta                     `json:",inline"`
	ListRecordingRuleSearchV0alpha1Body `json:",inline"`
}

func NewListRecordingRuleSearchV0alpha1Response() *ListRecordingRuleSearchV0alpha1Response {
	return &ListRecordingRuleSearchV0alpha1Response{}
}

func (t *ListRecordingRuleSearchV0alpha1Body) DeepCopyInto(dst *ListRecordingRuleSearchV0alpha1Body) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListRecordingRuleSearchV0alpha1Response) DeepCopyObject() runtime.Object {
	dst := NewListRecordingRuleSearchV0alpha1Response()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListRecordingRuleSearchV0alpha1Response) DeepCopyInto(dst *ListRecordingRuleSearchV0alpha1Response) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListRecordingRuleSearchV0alpha1Body.DeepCopyInto(&dst.ListRecordingRuleSearchV0alpha1Body)
}

func (ListRecordingRuleSearchV0alpha1Response) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1Response"
}

var _ runtime.Object = NewListRecordingRuleSearchV0alpha1Response()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchAlertRulesResponse struct {
	metav1.TypeMeta         `json:",inline"`
	metav1.ListMeta         `json:"metadata"`
	GetSearchAlertRulesBody `json:",inline"`
}

func NewGetSearchAlertRulesResponse() *GetSearchAlertRulesResponse {
	return &GetSearchAlertRulesResponse{}
}

func (t *GetSearchAlertRulesBody) DeepCopyInto(dst *GetSearchAlertRulesBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchAlertRulesResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSearchAlertRulesResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchAlertRulesResponse) DeepCopyInto(dst *GetSearchAlertRulesResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListMeta.DeepCopyInto(&dst.ListMeta)
	o.GetSearchAlertRulesBody.DeepCopyInto(&dst.GetSearchAlertRulesBody)
}

func (GetSearchAlertRulesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesResponse"
}

var _ runtime.Object = NewGetSearchAlertRulesResponse()

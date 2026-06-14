// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchRulesResponse struct {
	metav1.TypeMeta    `json:",inline"`
	metav1.ListMeta    `json:"metadata"`
	GetSearchRulesBody `json:",inline"`
}

func NewGetSearchRulesResponse() *GetSearchRulesResponse {
	return &GetSearchRulesResponse{}
}

func (t *GetSearchRulesBody) DeepCopyInto(dst *GetSearchRulesBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchRulesResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSearchRulesResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchRulesResponse) DeepCopyInto(dst *GetSearchRulesResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListMeta.DeepCopyInto(&dst.ListMeta)
	o.GetSearchRulesBody.DeepCopyInto(&dst.GetSearchRulesBody)
}

func (GetSearchRulesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesResponse"
}

var _ runtime.Object = NewGetSearchRulesResponse()

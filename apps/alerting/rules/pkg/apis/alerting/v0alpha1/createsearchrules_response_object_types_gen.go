// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateSearchRulesResponse struct {
	metav1.TypeMeta       `json:",inline"`
	CreateSearchRulesBody `json:",inline"`
}

func NewCreateSearchRulesResponse() *CreateSearchRulesResponse {
	return &CreateSearchRulesResponse{}
}

func (t *CreateSearchRulesBody) DeepCopyInto(dst *CreateSearchRulesBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateSearchRulesResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateSearchRulesResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateSearchRulesResponse) DeepCopyInto(dst *CreateSearchRulesResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateSearchRulesBody.DeepCopyInto(&dst.CreateSearchRulesBody)
}

func (CreateSearchRulesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesResponse"
}

var _ runtime.Object = NewCreateSearchRulesResponse()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchTeamsResponse struct {
	metav1.TypeMeta    `json:",inline"`
	GetSearchTeamsBody `json:",inline"`
}

func NewGetSearchTeamsResponse() *GetSearchTeamsResponse {
	return &GetSearchTeamsResponse{}
}

func (t *GetSearchTeamsBody) DeepCopyInto(dst *GetSearchTeamsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchTeamsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSearchTeamsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchTeamsResponse) DeepCopyInto(dst *GetSearchTeamsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSearchTeamsBody.DeepCopyInto(&dst.GetSearchTeamsBody)
}

func (GetSearchTeamsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchTeamsResponse"
}

var _ runtime.Object = NewGetSearchTeamsResponse()

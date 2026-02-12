// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeamsResponse struct {
	metav1.TypeMeta `json:",inline"`
	GetTeamsBody    `json:",inline"`
}

func NewGetTeamsResponse() *GetTeamsResponse {
	return &GetTeamsResponse{}
}

func (t *GetTeamsBody) DeepCopyInto(dst *GetTeamsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeamsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetTeamsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeamsResponse) DeepCopyInto(dst *GetTeamsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamsBody.DeepCopyInto(&dst.GetTeamsBody)
}

func (GetTeamsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamsResponse"
}

var _ runtime.Object = NewGetTeamsResponse()

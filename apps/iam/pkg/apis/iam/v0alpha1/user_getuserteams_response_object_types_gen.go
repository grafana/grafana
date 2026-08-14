// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetUserTeamsResponse struct {
	metav1.TypeMeta  `json:",inline"`
	metav1.ListMeta  `json:"metadata"`
	GetUserTeamsBody `json:",inline"`
}

func NewGetUserTeamsResponse() *GetUserTeamsResponse {
	return &GetUserTeamsResponse{}
}

func (t *GetUserTeamsBody) DeepCopyInto(dst *GetUserTeamsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetUserTeamsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetUserTeamsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetUserTeamsResponse) DeepCopyInto(dst *GetUserTeamsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListMeta.DeepCopyInto(&dst.ListMeta)
	o.GetUserTeamsBody.DeepCopyInto(&dst.GetUserTeamsBody)
}

func (GetUserTeamsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetUserTeamsResponse"
}

var _ runtime.Object = NewGetUserTeamsResponse()

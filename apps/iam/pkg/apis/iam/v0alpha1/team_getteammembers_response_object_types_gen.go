// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeamMembersResponse struct {
	metav1.TypeMeta    `json:",inline"`
	GetTeamMembersBody `json:",inline"`
}

func NewGetTeamMembersResponse() *GetTeamMembersResponse {
	return &GetTeamMembersResponse{}
}

func (t *GetTeamMembersBody) DeepCopyInto(dst *GetTeamMembersBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeamMembersResponse) DeepCopyObject() runtime.Object {
	dst := NewGetTeamMembersResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeamMembersResponse) DeepCopyInto(dst *GetTeamMembersResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamMembersBody.DeepCopyInto(&dst.GetTeamMembersBody)
}

func (GetTeamMembersResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamMembersResponse"
}

var _ runtime.Object = NewGetTeamMembersResponse()

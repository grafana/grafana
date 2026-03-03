// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeamGroupsResponse struct {
	metav1.TypeMeta   `json:",inline"`
	GetTeamGroupsBody `json:",inline"`
}

func NewGetTeamGroupsResponse() *GetTeamGroupsResponse {
	return &GetTeamGroupsResponse{}
}

func (t *GetTeamGroupsBody) DeepCopyInto(dst *GetTeamGroupsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeamGroupsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetTeamGroupsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeamGroupsResponse) DeepCopyInto(dst *GetTeamGroupsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamGroupsBody.DeepCopyInto(&dst.GetTeamGroupsBody)
}

func (GetTeamGroupsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamGroupsResponse"
}

var _ runtime.Object = NewGetTeamGroupsResponse()

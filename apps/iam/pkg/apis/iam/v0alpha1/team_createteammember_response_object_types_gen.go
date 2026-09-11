// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateTeamMemberResponse struct {
	metav1.TypeMeta      `json:",inline"`
	CreateTeamMemberBody `json:",inline"`
}

func NewCreateTeamMemberResponse() *CreateTeamMemberResponse {
	return &CreateTeamMemberResponse{}
}

func (t *CreateTeamMemberBody) DeepCopyInto(dst *CreateTeamMemberBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateTeamMemberResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateTeamMemberResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateTeamMemberResponse) DeepCopyInto(dst *CreateTeamMemberResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateTeamMemberBody.DeepCopyInto(&dst.CreateTeamMemberBody)
}

func (CreateTeamMemberResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateTeamMemberResponse"
}

var _ runtime.Object = NewCreateTeamMemberResponse()

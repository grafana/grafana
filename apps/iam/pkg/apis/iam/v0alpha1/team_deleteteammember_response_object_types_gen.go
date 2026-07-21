// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type DeleteTeamMemberResponse struct {
	metav1.TypeMeta      `json:",inline"`
	DeleteTeamMemberBody `json:",inline"`
}

func NewDeleteTeamMemberResponse() *DeleteTeamMemberResponse {
	return &DeleteTeamMemberResponse{}
}

func (t *DeleteTeamMemberBody) DeepCopyInto(dst *DeleteTeamMemberBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *DeleteTeamMemberResponse) DeepCopyObject() runtime.Object {
	dst := NewDeleteTeamMemberResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *DeleteTeamMemberResponse) DeepCopyInto(dst *DeleteTeamMemberResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.DeleteTeamMemberBody.DeepCopyInto(&dst.DeleteTeamMemberBody)
}

func (DeleteTeamMemberResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.DeleteTeamMemberResponse"
}

var _ runtime.Object = NewDeleteTeamMemberResponse()

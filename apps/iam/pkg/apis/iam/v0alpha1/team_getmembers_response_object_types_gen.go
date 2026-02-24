// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetMembersResponse struct {
	metav1.TypeMeta `json:",inline"`
	GetMembersBody  `json:",inline"`
}

func NewGetMembersResponse() *GetMembersResponse {
	return &GetMembersResponse{}
}

func (t *GetMembersBody) DeepCopyInto(dst *GetMembersBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetMembersResponse) DeepCopyObject() runtime.Object {
	dst := NewGetMembersResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetMembersResponse) DeepCopyInto(dst *GetMembersResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetMembersBody.DeepCopyInto(&dst.GetMembersBody)
}

func (GetMembersResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetMembersResponse"
}

var _ runtime.Object = NewGetMembersResponse()

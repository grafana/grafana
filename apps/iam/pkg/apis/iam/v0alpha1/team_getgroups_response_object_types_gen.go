// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetGroupsResponse struct {
	metav1.TypeMeta `json:",inline"`
	GetGroupsBody   `json:",inline"`
}

func NewGetGroupsResponse() *GetGroupsResponse {
	return &GetGroupsResponse{}
}

func (t *GetGroupsBody) DeepCopyInto(dst *GetGroupsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetGroupsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetGroupsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetGroupsResponse) DeepCopyInto(dst *GetGroupsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetGroupsBody.DeepCopyInto(&dst.GetGroupsBody)
}

func (GetGroupsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetGroupsResponse"
}

var _ runtime.Object = NewGetGroupsResponse()

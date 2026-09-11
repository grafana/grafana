// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateSearchExternalGroupMappingsResponse struct {
	metav1.TypeMeta                       `json:",inline"`
	CreateSearchExternalGroupMappingsBody `json:",inline"`
}

func NewCreateSearchExternalGroupMappingsResponse() *CreateSearchExternalGroupMappingsResponse {
	return &CreateSearchExternalGroupMappingsResponse{}
}

func (t *CreateSearchExternalGroupMappingsBody) DeepCopyInto(dst *CreateSearchExternalGroupMappingsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateSearchExternalGroupMappingsResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateSearchExternalGroupMappingsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateSearchExternalGroupMappingsResponse) DeepCopyInto(dst *CreateSearchExternalGroupMappingsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateSearchExternalGroupMappingsBody.DeepCopyInto(&dst.CreateSearchExternalGroupMappingsBody)
}

func (CreateSearchExternalGroupMappingsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsResponse"
}

var _ runtime.Object = NewCreateSearchExternalGroupMappingsResponse()

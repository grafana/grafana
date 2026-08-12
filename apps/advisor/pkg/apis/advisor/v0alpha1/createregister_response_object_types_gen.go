// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateRegisterResponse struct {
	metav1.TypeMeta    `json:",inline"`
	CreateRegisterBody `json:",inline"`
}

func NewCreateRegisterResponse() *CreateRegisterResponse {
	return &CreateRegisterResponse{}
}

func (t *CreateRegisterBody) DeepCopyInto(dst *CreateRegisterBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateRegisterResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateRegisterResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateRegisterResponse) DeepCopyInto(dst *CreateRegisterResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateRegisterBody.DeepCopyInto(&dst.CreateRegisterBody)
}

func (CreateRegisterResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.CreateRegisterResponse"
}

var _ runtime.Object = NewCreateRegisterResponse()

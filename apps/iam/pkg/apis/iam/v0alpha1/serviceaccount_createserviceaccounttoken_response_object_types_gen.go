// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateServiceAccountTokenResponse struct {
	metav1.TypeMeta               `json:",inline"`
	CreateServiceAccountTokenBody `json:",inline"`
}

func NewCreateServiceAccountTokenResponse() *CreateServiceAccountTokenResponse {
	return &CreateServiceAccountTokenResponse{}
}

func (t *CreateServiceAccountTokenBody) DeepCopyInto(dst *CreateServiceAccountTokenBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateServiceAccountTokenResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateServiceAccountTokenResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateServiceAccountTokenResponse) DeepCopyInto(dst *CreateServiceAccountTokenResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateServiceAccountTokenBody.DeepCopyInto(&dst.CreateServiceAccountTokenBody)
}

func (CreateServiceAccountTokenResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateServiceAccountTokenResponse"
}

var _ runtime.Object = NewCreateServiceAccountTokenResponse()

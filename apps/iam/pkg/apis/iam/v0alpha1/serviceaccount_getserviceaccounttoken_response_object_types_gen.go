// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetServiceAccountTokenResponse struct {
	metav1.TypeMeta            `json:",inline"`
	GetServiceAccountTokenBody `json:",inline"`
}

func NewGetServiceAccountTokenResponse() *GetServiceAccountTokenResponse {
	return &GetServiceAccountTokenResponse{}
}

func (t *GetServiceAccountTokenBody) DeepCopyInto(dst *GetServiceAccountTokenBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetServiceAccountTokenResponse) DeepCopyObject() runtime.Object {
	dst := NewGetServiceAccountTokenResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetServiceAccountTokenResponse) DeepCopyInto(dst *GetServiceAccountTokenResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetServiceAccountTokenBody.DeepCopyInto(&dst.GetServiceAccountTokenBody)
}

func (GetServiceAccountTokenResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetServiceAccountTokenResponse"
}

var _ runtime.Object = NewGetServiceAccountTokenResponse()

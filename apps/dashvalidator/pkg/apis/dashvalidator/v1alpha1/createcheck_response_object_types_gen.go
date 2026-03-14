// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateCheckResponse struct {
	metav1.TypeMeta `json:",inline"`
	CreateCheckBody `json:",inline"`
}

func NewCreateCheckResponse() *CreateCheckResponse {
	return &CreateCheckResponse{}
}

func (t *CreateCheckBody) DeepCopyInto(dst *CreateCheckBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateCheckResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateCheckResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateCheckResponse) DeepCopyInto(dst *CreateCheckResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateCheckBody.DeepCopyInto(&dst.CreateCheckBody)
}

func (CreateCheckResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashvalidator.pkg.apis.dashvalidator.v1alpha1.CreateCheckResponse"
}

var _ runtime.Object = NewCreateCheckResponse()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateHitResponse struct {
	metav1.TypeMeta `json:",inline"`
	CreateHitBody   `json:",inline"`
}

func NewCreateHitResponse() *CreateHitResponse {
	return &CreateHitResponse{}
}

func (t *CreateHitBody) DeepCopyInto(dst *CreateHitBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateHitResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateHitResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateHitResponse) DeepCopyInto(dst *CreateHitResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateHitBody.DeepCopyInto(&dst.CreateHitBody)
}

func (CreateHitResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.CreateHitResponse"
}

var _ runtime.Object = NewCreateHitResponse()

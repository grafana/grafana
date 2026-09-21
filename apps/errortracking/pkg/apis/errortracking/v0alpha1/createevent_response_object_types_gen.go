// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateEventResponse struct {
	metav1.TypeMeta `json:",inline"`
	CreateEventBody `json:",inline"`
}

func NewCreateEventResponse() *CreateEventResponse {
	return &CreateEventResponse{}
}

func (t *CreateEventBody) DeepCopyInto(dst *CreateEventBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateEventResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateEventResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateEventResponse) DeepCopyInto(dst *CreateEventResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateEventBody.DeepCopyInto(&dst.CreateEventBody)
}

func (CreateEventResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.errortracking.pkg.apis.errortracking.v0alpha1.CreateEventResponse"
}

var _ runtime.Object = NewCreateEventResponse()

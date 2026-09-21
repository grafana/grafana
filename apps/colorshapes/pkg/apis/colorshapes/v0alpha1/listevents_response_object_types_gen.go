// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListEventsResponse struct {
	metav1.TypeMeta `json:",inline"`
	ListEventsBody  `json:",inline"`
}

func NewListEventsResponse() *ListEventsResponse {
	return &ListEventsResponse{}
}

func (t *ListEventsBody) DeepCopyInto(dst *ListEventsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListEventsResponse) DeepCopyObject() runtime.Object {
	dst := NewListEventsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListEventsResponse) DeepCopyInto(dst *ListEventsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListEventsBody.DeepCopyInto(&dst.ListEventsBody)
}

func (ListEventsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListEventsResponse"
}

var _ runtime.Object = NewListEventsResponse()

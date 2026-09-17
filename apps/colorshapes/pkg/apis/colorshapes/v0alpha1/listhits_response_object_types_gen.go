// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListHitsResponse struct {
	metav1.TypeMeta `json:",inline"`
	ListHitsBody    `json:",inline"`
}

func NewListHitsResponse() *ListHitsResponse {
	return &ListHitsResponse{}
}

func (t *ListHitsBody) DeepCopyInto(dst *ListHitsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListHitsResponse) DeepCopyObject() runtime.Object {
	dst := NewListHitsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListHitsResponse) DeepCopyInto(dst *ListHitsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListHitsBody.DeepCopyInto(&dst.ListHitsBody)
}

func (ListHitsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListHitsResponse"
}

var _ runtime.Object = NewListHitsResponse()

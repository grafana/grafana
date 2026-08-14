// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchResponse struct {
	metav1.TypeMeta `json:",inline"`
	GetSearchBody   `json:",inline"`
}

func NewGetSearchResponse() *GetSearchResponse {
	return &GetSearchResponse{}
}

func (t *GetSearchBody) DeepCopyInto(dst *GetSearchBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchResponse) DeepCopyObject() runtime.Object {
	dst := NewGetSearchResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchResponse) DeepCopyInto(dst *GetSearchResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSearchBody.DeepCopyInto(&dst.GetSearchBody)
}

func (GetSearchResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchResponse"
}

var _ runtime.Object = NewGetSearchResponse()

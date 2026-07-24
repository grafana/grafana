// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTranslationsResponse struct {
	metav1.TypeMeta     `json:",inline"`
	GetTranslationsBody `json:",inline"`
}

func NewGetTranslationsResponse() *GetTranslationsResponse {
	return &GetTranslationsResponse{}
}

func (t *GetTranslationsBody) DeepCopyInto(dst *GetTranslationsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTranslationsResponse) DeepCopyObject() runtime.Object {
	dst := NewGetTranslationsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTranslationsResponse) DeepCopyInto(dst *GetTranslationsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTranslationsBody.DeepCopyInto(&dst.GetTranslationsBody)
}

func (GetTranslationsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.GetTranslationsResponse"
}

var _ runtime.Object = NewGetTranslationsResponse()

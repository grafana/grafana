// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListManifestsResponse struct {
	metav1.TypeMeta   `json:",inline"`
	ListManifestsBody `json:",inline"`
}

func NewListManifestsResponse() *ListManifestsResponse {
	return &ListManifestsResponse{}
}

func (t *ListManifestsBody) DeepCopyInto(dst *ListManifestsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListManifestsResponse) DeepCopyObject() runtime.Object {
	dst := NewListManifestsResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListManifestsResponse) DeepCopyInto(dst *ListManifestsResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListManifestsBody.DeepCopyInto(&dst.ListManifestsBody)
}

func (ListManifestsResponse) OpenAPIModelName() string {
	return "com.github.demo.manifest.pkg.generated.v1alpha1.ListManifestsResponse"
}

var _ runtime.Object = NewListManifestsResponse()

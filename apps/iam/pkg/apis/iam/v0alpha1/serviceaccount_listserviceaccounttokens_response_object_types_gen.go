// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type ListServiceAccountTokensResponse struct {
	metav1.TypeMeta              `json:",inline"`
	ListServiceAccountTokensBody `json:",inline"`
}

func NewListServiceAccountTokensResponse() *ListServiceAccountTokensResponse {
	return &ListServiceAccountTokensResponse{}
}

func (t *ListServiceAccountTokensBody) DeepCopyInto(dst *ListServiceAccountTokensBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *ListServiceAccountTokensResponse) DeepCopyObject() runtime.Object {
	dst := NewListServiceAccountTokensResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListServiceAccountTokensResponse) DeepCopyInto(dst *ListServiceAccountTokensResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.ListServiceAccountTokensBody.DeepCopyInto(&dst.ListServiceAccountTokensBody)
}

func (ListServiceAccountTokensResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ListServiceAccountTokensResponse"
}

var _ runtime.Object = NewListServiceAccountTokensResponse()

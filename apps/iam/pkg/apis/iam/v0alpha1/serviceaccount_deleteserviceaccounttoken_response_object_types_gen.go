// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type DeleteServiceAccountTokenResponse struct {
	metav1.TypeMeta               `json:",inline"`
	DeleteServiceAccountTokenBody `json:",inline"`
}

func NewDeleteServiceAccountTokenResponse() *DeleteServiceAccountTokenResponse {
	return &DeleteServiceAccountTokenResponse{}
}

func (t *DeleteServiceAccountTokenBody) DeepCopyInto(dst *DeleteServiceAccountTokenBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *DeleteServiceAccountTokenResponse) DeepCopyObject() runtime.Object {
	dst := NewDeleteServiceAccountTokenResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *DeleteServiceAccountTokenResponse) DeepCopyInto(dst *DeleteServiceAccountTokenResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.DeleteServiceAccountTokenBody.DeepCopyInto(&dst.DeleteServiceAccountTokenBody)
}

func (DeleteServiceAccountTokenResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.DeleteServiceAccountTokenResponse"
}

var _ runtime.Object = NewDeleteServiceAccountTokenResponse()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateReceiverIntegrationTestResponse struct {
	metav1.TypeMeta                   `json:",inline"`
	CreateReceiverIntegrationTestBody `json:",inline"`
}

func NewCreateReceiverIntegrationTestResponse() *CreateReceiverIntegrationTestResponse {
	return &CreateReceiverIntegrationTestResponse{}
}

func (t *CreateReceiverIntegrationTestBody) DeepCopyInto(dst *CreateReceiverIntegrationTestBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateReceiverIntegrationTestResponse) DeepCopyObject() runtime.Object {
	dst := NewCreateReceiverIntegrationTestResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateReceiverIntegrationTestResponse) DeepCopyInto(dst *CreateReceiverIntegrationTestResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateReceiverIntegrationTestBody.DeepCopyInto(&dst.CreateReceiverIntegrationTestBody)
}

func (CreateReceiverIntegrationTestResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestResponse"
}

var _ runtime.Object = NewCreateReceiverIntegrationTestResponse()

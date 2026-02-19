// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateReceiverIntegrationTest struct {
	metav1.TypeMeta                   `json:",inline"`
	CreateReceiverIntegrationTestBody `json:",inline"`
}

func NewCreateReceiverIntegrationTest() *CreateReceiverIntegrationTest {
	return &CreateReceiverIntegrationTest{}
}

func (t *CreateReceiverIntegrationTestBody) DeepCopyInto(dst *CreateReceiverIntegrationTestBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateReceiverIntegrationTest) DeepCopyObject() runtime.Object {
	dst := NewCreateReceiverIntegrationTest()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateReceiverIntegrationTest) DeepCopyInto(dst *CreateReceiverIntegrationTest) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateReceiverIntegrationTestBody.DeepCopyInto(&dst.CreateReceiverIntegrationTestBody)
}

var _ runtime.Object = NewCreateReceiverIntegrationTest()

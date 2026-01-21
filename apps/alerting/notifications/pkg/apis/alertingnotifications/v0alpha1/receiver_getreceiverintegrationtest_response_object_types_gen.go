// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetReceiverIntegrationTest struct {
	metav1.TypeMeta                `json:",inline"`
	GetReceiverIntegrationTestBody `json:",inline"`
}

func NewGetReceiverIntegrationTest() *GetReceiverIntegrationTest {
	return &GetReceiverIntegrationTest{}
}

func (t *GetReceiverIntegrationTestBody) DeepCopyInto(dst *GetReceiverIntegrationTestBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetReceiverIntegrationTest) DeepCopyObject() runtime.Object {
	dst := NewGetReceiverIntegrationTest()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetReceiverIntegrationTest) DeepCopyInto(dst *GetReceiverIntegrationTest) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetReceiverIntegrationTestBody.DeepCopyInto(&dst.GetReceiverIntegrationTestBody)
}

var _ runtime.Object = NewGetReceiverIntegrationTest()

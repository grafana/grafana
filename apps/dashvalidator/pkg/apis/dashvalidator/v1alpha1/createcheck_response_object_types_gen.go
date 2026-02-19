// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateCheck struct {
	metav1.TypeMeta `json:",inline"`
	CreateCheckBody `json:",inline"`
}

func NewCreateCheck() *CreateCheck {
	return &CreateCheck{}
}

func (t *CreateCheckBody) DeepCopyInto(dst *CreateCheckBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateCheck) DeepCopyObject() runtime.Object {
	dst := NewCreateCheck()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateCheck) DeepCopyInto(dst *CreateCheck) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateCheckBody.DeepCopyInto(&dst.CreateCheckBody)
}

var _ runtime.Object = NewCreateCheck()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type CreateRegister struct {
	metav1.TypeMeta    `json:",inline"`
	CreateRegisterBody `json:",inline"`
}

func NewCreateRegister() *CreateRegister {
	return &CreateRegister{}
}

func (t *CreateRegisterBody) DeepCopyInto(dst *CreateRegisterBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *CreateRegister) DeepCopyObject() runtime.Object {
	dst := NewCreateRegister()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateRegister) DeepCopyInto(dst *CreateRegister) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.CreateRegisterBody.DeepCopyInto(&dst.CreateRegisterBody)
}

var _ runtime.Object = NewCreateRegister()

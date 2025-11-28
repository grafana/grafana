// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetQuotas struct {
	metav1.TypeMeta `json:",inline"`
	GetQuotasBody   `json:",inline"`
}

func NewGetQuotas() *GetQuotas {
	return &GetQuotas{}
}

func (t *GetQuotasBody) DeepCopyInto(dst *GetQuotasBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetQuotas) DeepCopyObject() runtime.Object {
	dst := NewGetQuotas()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetQuotas) DeepCopyInto(dst *GetQuotas) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetQuotasBody.DeepCopyInto(&dst.GetQuotasBody)
}

var _ runtime.Object = NewGetQuotas()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearch struct {
	metav1.TypeMeta `json:",inline"`
	GetSearchBody   `json:",inline"`
}

func NewGetSearch() *GetSearch {
	return &GetSearch{}
}

func (t *GetSearchBody) DeepCopyInto(dst *GetSearchBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearch) DeepCopyObject() runtime.Object {
	dst := NewGetSearch()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearch) DeepCopyInto(dst *GetSearch) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSearchBody.DeepCopyInto(&dst.GetSearchBody)
}

var _ runtime.Object = NewGetSearch()

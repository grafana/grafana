// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetGroups struct {
	metav1.TypeMeta `json:",inline"`
	GetGroupsBody   `json:",inline"`
}

func NewGetGroups() *GetGroups {
	return &GetGroups{}
}

func (t *GetGroupsBody) DeepCopyInto(dst *GetGroupsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetGroups) DeepCopyObject() runtime.Object {
	dst := NewGetGroups()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetGroups) DeepCopyInto(dst *GetGroups) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetGroupsBody.DeepCopyInto(&dst.GetGroupsBody)
}

var _ runtime.Object = NewGetGroups()

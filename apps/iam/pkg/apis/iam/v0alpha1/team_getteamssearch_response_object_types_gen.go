// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeamssearch struct {
	metav1.TypeMeta    `json:",inline"`
	GetTeamssearchBody `json:",inline"`
}

func NewGetTeamssearch() *GetTeamssearch {
	return &GetTeamssearch{}
}

func (t *GetTeamssearchBody) DeepCopyInto(dst *GetTeamssearchBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeamssearch) DeepCopyObject() runtime.Object {
	dst := NewGetTeamssearch()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeamssearch) DeepCopyInto(dst *GetTeamssearch) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamssearchBody.DeepCopyInto(&dst.GetTeamssearchBody)
}

var _ runtime.Object = NewGetTeamssearch()

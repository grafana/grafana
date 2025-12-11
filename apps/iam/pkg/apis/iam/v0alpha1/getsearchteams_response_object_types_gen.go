// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetSearchTeams struct {
	metav1.TypeMeta    `json:",inline"`
	GetSearchTeamsBody `json:",inline"`
}

func NewGetSearchTeams() *GetSearchTeams {
	return &GetSearchTeams{}
}

func (t *GetSearchTeamsBody) DeepCopyInto(dst *GetSearchTeamsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetSearchTeams) DeepCopyObject() runtime.Object {
	dst := NewGetSearchTeams()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetSearchTeams) DeepCopyInto(dst *GetSearchTeams) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetSearchTeamsBody.DeepCopyInto(&dst.GetSearchTeamsBody)
}

var _ runtime.Object = NewGetSearchTeams()

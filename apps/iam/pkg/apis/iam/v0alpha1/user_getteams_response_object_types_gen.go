// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeams struct {
	metav1.TypeMeta `json:",inline"`
	GetTeamsBody    `json:",inline"`
}

func NewGetTeams() *GetTeams {
	return &GetTeams{}
}

func (t *GetTeamsBody) DeepCopyInto(dst *GetTeamsBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeams) DeepCopyObject() runtime.Object {
	dst := NewGetTeams()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeams) DeepCopyInto(dst *GetTeams) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamsBody.DeepCopyInto(&dst.GetTeamsBody)
}

var _ runtime.Object = NewGetTeams()

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type CreateSearchExternalGroupMappingsRequestParamsObject struct {
	metav1.TypeMeta                                `json:",inline"`
	CreateSearchExternalGroupMappingsRequestParams `json:",inline"`
}

func NewCreateSearchExternalGroupMappingsRequestParamsObject() *CreateSearchExternalGroupMappingsRequestParamsObject {
	return &CreateSearchExternalGroupMappingsRequestParamsObject{}
}

func (o *CreateSearchExternalGroupMappingsRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewCreateSearchExternalGroupMappingsRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *CreateSearchExternalGroupMappingsRequestParamsObject) DeepCopyInto(dst *CreateSearchExternalGroupMappingsRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstCreateSearchExternalGroupMappingsRequestParams := CreateSearchExternalGroupMappingsRequestParams{}
	_ = resource.CopyObjectInto(&dstCreateSearchExternalGroupMappingsRequestParams, &o.CreateSearchExternalGroupMappingsRequestParams)
}

func (CreateSearchExternalGroupMappingsRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsRequestParamsObject"
}

var _ runtime.Object = NewCreateSearchExternalGroupMappingsRequestParamsObject()

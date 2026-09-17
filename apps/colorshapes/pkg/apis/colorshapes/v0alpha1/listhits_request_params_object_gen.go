// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type ListHitsRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    ListHitsRequestParams `json:",inline"`
}

func NewListHitsRequestParamsObject() *ListHitsRequestParamsObject {
    return &ListHitsRequestParamsObject{}
}

func (o *ListHitsRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewListHitsRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *ListHitsRequestParamsObject) DeepCopyInto(dst *ListHitsRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstListHitsRequestParams := ListHitsRequestParams{}
    _ = resource.CopyObjectInto(&dstListHitsRequestParams, &o.ListHitsRequestParams)
}


func (ListHitsRequestParamsObject) OpenAPIModelName() string {
    return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListHitsRequestParamsObject"
}

var _ runtime.Object = NewListHitsRequestParamsObject()
// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type ListEventsRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    ListEventsRequestParams `json:",inline"`
}

func NewListEventsRequestParamsObject() *ListEventsRequestParamsObject {
    return &ListEventsRequestParamsObject{}
}

func (o *ListEventsRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewListEventsRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *ListEventsRequestParamsObject) DeepCopyInto(dst *ListEventsRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstListEventsRequestParams := ListEventsRequestParams{}
    _ = resource.CopyObjectInto(&dstListEventsRequestParams, &o.ListEventsRequestParams)
}


func (ListEventsRequestParamsObject) OpenAPIModelName() string {
    return "com.github.grafana.grafana.apps.errortracking.pkg.apis.errortracking.v0alpha1.ListEventsRequestParamsObject"
}

var _ runtime.Object = NewListEventsRequestParamsObject()
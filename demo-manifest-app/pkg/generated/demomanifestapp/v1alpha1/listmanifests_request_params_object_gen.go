// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type ListManifestsRequestParamsObject struct {
    metav1.TypeMeta `json:",inline"`
    ListManifestsRequestParams `json:",inline"`
}

func NewListManifestsRequestParamsObject() *ListManifestsRequestParamsObject {
    return &ListManifestsRequestParamsObject{}
}

func (o *ListManifestsRequestParamsObject) DeepCopyObject() runtime.Object {
    dst := NewListManifestsRequestParamsObject()
    o.DeepCopyInto(dst)
    return dst
}

func (o *ListManifestsRequestParamsObject) DeepCopyInto(dst *ListManifestsRequestParamsObject) {
    dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
    dst.TypeMeta.Kind = o.TypeMeta.Kind
    dstListManifestsRequestParams := ListManifestsRequestParams{}
    _ = resource.CopyObjectInto(&dstListManifestsRequestParams, &o.ListManifestsRequestParams)
}


func (ListManifestsRequestParamsObject) OpenAPIModelName() string {
    return "com.github.demo.manifest.pkg.generated.v1alpha1.ListManifestsRequestParamsObject"
}

var _ runtime.Object = NewListManifestsRequestParamsObject()
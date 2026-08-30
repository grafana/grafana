// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type ListServiceAccountTokensRequestParamsObject struct {
	metav1.TypeMeta                       `json:",inline"`
	ListServiceAccountTokensRequestParams `json:",inline"`
}

func NewListServiceAccountTokensRequestParamsObject() *ListServiceAccountTokensRequestParamsObject {
	return &ListServiceAccountTokensRequestParamsObject{}
}

func (o *ListServiceAccountTokensRequestParamsObject) DeepCopyObject() runtime.Object {
	dst := NewListServiceAccountTokensRequestParamsObject()
	o.DeepCopyInto(dst)
	return dst
}

func (o *ListServiceAccountTokensRequestParamsObject) DeepCopyInto(dst *ListServiceAccountTokensRequestParamsObject) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	dstListServiceAccountTokensRequestParams := ListServiceAccountTokensRequestParams{}
	_ = resource.CopyObjectInto(&dstListServiceAccountTokensRequestParams, &o.ListServiceAccountTokensRequestParams)
}

func (ListServiceAccountTokensRequestParamsObject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ListServiceAccountTokensRequestParamsObject"
}

var _ runtime.Object = NewListServiceAccountTokensRequestParamsObject()

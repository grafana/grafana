package v1alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetOtherRequestParamsObject struct {
    metav1.TypeMeta
    GetOtherRequestParams
}

func (o *GetOtherRequestParamsObject) DeepCopyObject() runtime.Object {
    return resource.CopyObject(o)
}
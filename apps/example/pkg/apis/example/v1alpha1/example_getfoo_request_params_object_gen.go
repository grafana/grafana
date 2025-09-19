package v1alpha1

import (
    "github.com/grafana/grafana-app-sdk/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type GetFooRequestParamsObject struct {
    metav1.TypeMeta
    GetFooRequestParams
}

func (o *GetFooRequestParamsObject) DeepCopyObject() runtime.Object {
    return resource.CopyObject(o)
}
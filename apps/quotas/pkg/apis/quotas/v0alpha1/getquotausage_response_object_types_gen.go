// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetQuotaUsageResponse struct {
	metav1.TypeMeta   `json:",inline"`
	GetQuotaUsageBody `json:",inline"`
}

func NewGetQuotaUsageResponse() *GetQuotaUsageResponse {
	return &GetQuotaUsageResponse{}
}

func (t *GetQuotaUsageBody) DeepCopyInto(dst *GetQuotaUsageBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetQuotaUsageResponse) DeepCopyObject() runtime.Object {
	dst := NewGetQuotaUsageResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetQuotaUsageResponse) DeepCopyInto(dst *GetQuotaUsageResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetQuotaUsageBody.DeepCopyInto(&dst.GetQuotaUsageBody)
}

func (GetQuotaUsageResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.quotas.pkg.apis.quotas.v0alpha1.GetQuotaUsageResponse"
}

var _ runtime.Object = NewGetQuotaUsageResponse()

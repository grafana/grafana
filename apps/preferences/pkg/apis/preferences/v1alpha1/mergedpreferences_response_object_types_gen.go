// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type MergedPreferencesResponse struct {
	metav1.TypeMeta       `json:",inline"`
	MergedPreferencesBody `json:",inline"`
}

func NewMergedPreferencesResponse() *MergedPreferencesResponse {
	return &MergedPreferencesResponse{}
}

func (t *MergedPreferencesBody) DeepCopyInto(dst *MergedPreferencesBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *MergedPreferencesResponse) DeepCopyObject() runtime.Object {
	dst := NewMergedPreferencesResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *MergedPreferencesResponse) DeepCopyInto(dst *MergedPreferencesResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.MergedPreferencesBody.DeepCopyInto(&dst.MergedPreferencesBody)
}

func (MergedPreferencesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.preferences.pkg.apis.preferences.v1alpha1.MergedPreferencesResponse"
}

var _ runtime.Object = NewMergedPreferencesResponse()

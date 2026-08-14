package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// PermissionsSearchResult is the response body for the resourcepermissions search endpoint
// (GET /apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/resourcepermissions/search?userUID=...).
// +k8s:openapi-gen=true
type PermissionsSearchResult struct {
	metav1.TypeMeta `json:",inline"`
	Permissions     []PermissionSpec `json:"permissions"`
}

// DirectPermissionSpec is a single permission (action + scope) in a PermissionsSearchResult.
// +k8s:openapi-gen=true
type PermissionSpec struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

// DeepCopyObject implements runtime.Object.
func (d *PermissionsSearchResult) DeepCopyObject() runtime.Object {
	if d == nil {
		return nil
	}
	out := &PermissionsSearchResult{
		TypeMeta:    d.TypeMeta,
		Permissions: make([]PermissionSpec, len(d.Permissions)),
	}
	copy(out.Permissions, d.Permissions)
	return out
}

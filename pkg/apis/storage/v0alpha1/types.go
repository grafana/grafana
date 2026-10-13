package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const (
	GROUP      = "storage.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION

	KindListKeyRequest = "ListKeyRequest"
)

// ListKeyRequest is the request body for POST .../{resource}/list-keys.
// Every field is optional. When set, apiVersion must be storage.grafana.app/v0alpha1
// and kind must be ListKeyRequest. Other fields are rejected because selectors,
// watch and timeouts cannot be evaluated without reading objects.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ListKeyRequest struct {
	metav1.TypeMeta `json:",inline"`

	// Limit is the maximum number of keys to return in one page. Must not be negative.
	Limit int64 `json:"limit,omitempty"`

	// Continue is an opaque pagination token from a previous page.
	Continue string `json:"continue,omitempty"`

	// ResourceVersion is the resource version to list at. Must be a non-negative integer.
	ResourceVersion string `json:"resourceVersion,omitempty"`
}

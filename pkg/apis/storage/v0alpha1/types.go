package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const (
	GROUP      = "storage.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION

	KindListKeyRequest  = "ListKeyRequest"
	KindListKeyResponse = "ListKeyResponse"
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

// ListKeyResponse is one page of keys from POST .../{resource}/list-keys:
// identities only, with no object bodies.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ListKeyResponse struct {
	metav1.TypeMeta `json:",inline"`

	// ResourceVersion is the snapshot every page is taken at. Callers need it to
	// arbitrate list-versus-event races.
	ResourceVersion string `json:"resourceVersion"`

	// Continue is the token for the next page. Empty on the last page.
	Continue string `json:"continue,omitempty"`

	// +listType=atomic
	Items []ListKeyItem `json:"items"`
}

// ListKeyItem is the identity of one object.
type ListKeyItem struct {
	// Namespace is set per item because a cluster-wide list spans namespaces.
	Namespace string `json:"namespace"`

	Name string `json:"name"`

	ResourceVersion string `json:"resourceVersion"`

	// Folder is absent when the object is not in a folder.
	Folder string `json:"folder,omitempty"`
}

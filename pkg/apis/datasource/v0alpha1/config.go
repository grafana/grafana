package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type GenericDataSource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`

	// generic config
	Spec GenericDataSourceSpec `json:"spec"`

	// Secure values placeholder (true for fields that exist)
	Secure map[string]bool `json:"secure,omitempty"`

	// // swagger:ignore
	// Password string `json:"-"`

	// // swagger:ignore
	// BasicAuthPassword string `json:"-"`
}

type DsAccess string // proxy | direct

type GenericDataSourceSpec struct {
	// The diplay name (NOTE, this used to be the "name")
	Title string `json:"title"`

	// Direct or proxy?
	Access DsAccess `json:"access,omitempty"`

	// Server URL
	URL string `json:"url,omitempty"`

	User            string `json:"use,omitempty"`
	Database        string `json:"database,omitempty"`
	BasicAuth       bool   `json:"basicAuth,omitempty"`
	BasicAuthUser   string `json:"basicAuthUser,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`
	IsDefault       bool   `json:"isDefault,omitempty"`
	ReadOnly        bool   `json:"readOnly,omitempty"`

	// Generic unstructured configuration settings
	JsonData common.Unstructured `json:"jsonData,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type GenericDataSourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []GenericDataSource `json:"items"`
}

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
	Secure map[string]SecureValue `json:"secure,omitempty"`
}

type SecureValue struct {
	// The input is only valid for writing the value -- it is replaced on read
	Input string `json:"input,omitempty"`

	// The name identifier for this secure value
	Reference string `json:"ref,omitempty"`

	// Value for write, this will remove the secret value
	Remove bool `json:"remove,omitempty"`
}

// DsAccess represents how the datasource connects to the remote service
// +enum
type DsAccess string

const (
	// The frontend can connect directly to the remote URL
	// This method is discouraged
	DsAccessDirect DsAccess = "direct"

	// Connect to the remote datasource through the grafana backend
	DsAccessProxy DsAccess = "proxy"
)

func (dsa DsAccess) String() string {
	return string(dsa)
}

type GenericDataSourceSpec struct {
	// The diplay name (previously saved as the "name" property)
	Title string `json:"title"`

	Access    DsAccess `json:"access,omitempty"`
	ReadOnly  bool     `json:"readOnly,omitempty"`
	IsDefault bool     `json:"isDefault,omitempty"`

	// Server URL
	URL string `json:"url,omitempty"`

	User            string `json:"use,omitempty"`
	Database        string `json:"database,omitempty"`
	BasicAuth       bool   `json:"basicAuth,omitempty"`
	BasicAuthUser   string `json:"basicAuthUser,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`

	// Generic unstructured configuration settings
	JsonData common.Unstructured `json:"jsonData,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type GenericDataSourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []GenericDataSource `json:"items"`
}

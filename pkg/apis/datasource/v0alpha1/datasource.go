package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`

	// DataSource configuration -- these properties are all visible
	// to anyone able to query the data source from their browser
	Spec UnstructuredSpec `json:"spec"`

	// Secure values allows setting values that are never shown to users
	// The returned properties are only the names of the configured values
	Secure common.InlineSecureValues `json:"secure,omitzero,omitempty"`
}

// DsAccess represents how the datasource connects to the remote service
// +k8s:openapi-gen=true
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

// +k8s:openapi-gen=true
type GenericDataSourceSpec struct {
	// The display name (previously saved as the "name" property)
	Title string `json:"title"`

	Access    DsAccess `json:"access,omitempty"`
	ReadOnly  bool     `json:"readOnly,omitempty"`
	IsDefault bool     `json:"isDefault,omitempty"`

	// Server URL
	URL string `json:"url,omitempty"`

	User            string `json:"user,omitempty"`
	Database        string `json:"database,omitempty"`
	BasicAuth       bool   `json:"basicAuth,omitempty"`
	BasicAuthUser   string `json:"basicAuthUser,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`

	// Generic unstructured configuration settings
	JsonData common.Unstructured `json:"jsonData,omitzero"`
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []DataSource `json:"items"`
}

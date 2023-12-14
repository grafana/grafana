package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

const (
	GROUP   = "*.datasource.grafana.app"
	VERSION = "v0alpha1"
)

var GenericConnectionResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"connections", "connection", "DataSourceConnection",
	func() runtime.Object { return &DataSourceConnection{} },
	func() runtime.Object { return &DataSourceConnectionList{} },
)

var GenericConfigResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"config", "config", "DataSourceConfig",
	func() runtime.Object { return &DataSourceConfig{} },
	func() runtime.Object { return &DataSourceConfigList{} },
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The display name
	Title string `json:"title"`

	// Optional description for the data source (does not exist yet)
	Description string `json:"description,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnectionList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DataSourceConnection `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConfig struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The generic datasource config
	Spec ConfigSpec `json:"spec"`

	// Generic secure keys -- this will accept strings as input,
	// but the results will become keys into a secret store
	Secure SecureSpec `json:"secure"`
}

type ConfigSpec struct {
	Name     string `json:"name"`
	Access   string `json:"access,omitempty"` // proxy??
	URL      string `json:"url,omitempty"`
	ReadOnly bool   `json:"readOnly,omitempty"`

	User            string `json:"user"`
	Database        string `json:"database"`
	BasicAuth       bool   `json:"basicAuth,omitempty"`
	BasicAuthUser   string `json:"basicAuthUser"`
	WithCredentials bool   `json:"withCredentials,omitempty"` // ???

	// The public generic config data
	JsonData *simplejson.Json `json:"jsonData"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConfigList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DataSourceConfig `json:"items,omitempty"`
}

// TODO.. obviously something better
type SecureSpec struct {
	// Database password
	Password string `json:"password,omitempty"`

	// BasicAuthPassword
	BasicAuthPassword string `json:"basicAuthPassword,omitempty"`

	SecureJsonData map[string]string `json:"json,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HealthCheckResult struct {
	metav1.TypeMeta `json:",inline"`

	// The string description
	Status string `json:"status,omitempty"`

	// Explicit status code
	Code int `json:"code,omitempty"`

	// Optional description for the data source (does not exist yet)
	Message string `json:"message,omitempty"`

	// Depends on the explicit kind
	Details *simplejson.Json `json:"details,omitempty"`
}

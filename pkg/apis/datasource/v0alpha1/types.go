package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis"
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
type HealthCheckResult struct {
	metav1.TypeMeta `json:",inline"`

	// The string description
	Status string `json:"status,omitempty"`

	// Explicit status code
	Code int `json:"code,omitempty"`

	// Optional description for the data source
	Message string `json:"message,omitempty"`

	// Spec depends on the the plugin
	Details *Unstructured `json:"details,omitempty"`
}

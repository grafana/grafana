package v0alpha1

import (
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Generic query request with shared time across all values
// Copied from: https://github.com/grafana/grafana/blob/main/pkg/api/dtos/models.go#L62
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataRequest struct {
	metav1.TypeMeta `json:",inline"`

	// The time range used when not included on each query
	resource.TimeRange `json:",inline"`

	// Queries sent to datasources
	Queries []resource.DataQuery `json:"queries"`

	// Include debug information in the results
	Debug bool `json:"debug,omitempty"`
}

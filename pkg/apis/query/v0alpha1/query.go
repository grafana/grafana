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

	// From Start time in epoch timestamps in milliseconds or relative using Grafana time units.
	// example: now-1h
	From string `json:"from,omitempty"`

	// To End time in epoch timestamps in milliseconds or relative using Grafana time units.
	// example: now
	To string `json:"to,omitempty"`

	// queries.refId – Specifies an identifier of the query. Is optional and default to “A”.
	// queries.datasourceId – Specifies the data source to be queried. Each query in the request must have an unique datasourceId.
	// queries.maxDataPoints - Species maximum amount of data points that dashboard panel can render. Is optional and default to 100.
	// queries.intervalMs - Specifies the time interval in milliseconds of time series. Is optional and defaults to 1000.
	// required: true
	// example: [ { "refId": "A", "intervalMs": 86400000, "maxDataPoints": 1092, "datasource":{ "uid":"PD8C576611E62080A" }, "rawSql": "SELECT 1 as valueOne, 2 as valueTwo", "format": "table" } ]
	Queries []resource.DataQuery `json:"queries"`

	// required: false
	Debug bool `json:"debug,omitempty"`
}

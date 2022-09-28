package querylibrary

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
)

type Time struct {
	// From Start time in epoch timestamps in milliseconds or relative using Grafana time units.
	// required: true
	// example: now-1h
	From string `json:"from"`

	// To End time in epoch timestamps in milliseconds or relative using Grafana time units.
	// required: true
	// example: now
	To string `json:"to"`
}

type Query struct {
	UID string `json:"uid"`

	Title string `json:"title"`

	Tags []string `json:"tags"`

	Description string `json:"description"`

	SchemaVersion int64 `json:"schemaVersion"`

	Time Time `json:"time"`

	// queries.refId – Specifies an identifier of the query. Is optional and default to “A”.
	// queries.datasourceId – Specifies the data source to be queried. Each query in the request must have an unique datasourceId.
	// queries.maxDataPoints - Species maximum amount of data points that dashboard panel can render. Is optional and default to 100.
	// queries.intervalMs - Specifies the time interval in milliseconds of time series. Is optional and defaults to 1000.
	// required: true
	// example: [ { "refId": "A", "intervalMs": 86400000, "maxDataPoints": 1092, "datasource":{ "uid":"PD8C576611E62080A" }, "rawSql": "SELECT 1 as valueOne, 2 as valueTwo", "format": "table" } ]
	Queries []*simplejson.Json `json:"queries"`

	Variables []*simplejson.Json `json:"variables"`
}

type SavedQueryRef struct {
	UID string `json:"uid"`
}

type SavedQueryLink struct {
	Ref SavedQueryRef `json:"ref"`
}

type QueryInfo struct {
	UID           string   `json:"uid"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Tags          []string `json:"tags"`
	TimeFrom      string   `json:"timeFrom"`
	TimeTo        string   `json:"timeTo"`
	SchemaVersion int64    `json:"schemaVersion"`

	Datasource []dslookup.DataSourceRef `json:"datasource,omitempty"` // UIDs
}

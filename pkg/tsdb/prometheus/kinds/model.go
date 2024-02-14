package kinds

// PromQueryFormat defines model for PromQueryFormat.
// +enum
type PromQueryFormat string

const (
	PromQueryFormatTimeSeries PromQueryFormat = "time_series"
	PromQueryFormatTable      PromQueryFormat = "table"
	PromQueryFormatHeatmap    PromQueryFormat = "heatmap"
)

// QueryEditorMode defines model for QueryEditorMode.
// +enum
type QueryEditorMode string

const (
	QueryEditorModeBuilder QueryEditorMode = "builder"
	QueryEditorModeCode    QueryEditorMode = "code"
)

// PrometheusDataQuery defines model for PrometheusDataQuery.
type PrometheusDataQuery struct {
	// The response format
	Format PromQueryFormat `json:"format,omitempty"`

	// The actual expression/query that will be evaluated by Prometheus
	Expr string `json:"expr"`

	// Returns a Range vector, comprised of a set of time series containing a range of data points over time for each time series
	Range bool `json:"range,omitempty"`

	// Returns only the latest value that Prometheus has scraped for the requested time series
	Instant bool `json:"instant,omitempty"`

	// Execute an additional query to identify interesting raw samples relevant for the given expr
	Exemplar bool `json:"exemplar,omitempty"`

	// what we should show in the editor
	EditorMode QueryEditorMode `json:"editorMode,omitempty"`

	// @deprecated Used to specify how many times to divide max data points by. We use max data points under query options
	// See https://github.com/grafana/grafana/issues/48081
	IntervalFactor *float32 `json:"intervalFactor,omitempty"`

	// Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname
	LegendFormat string `json:"legendFormat,omitempty"`

	// ???
	Scope *struct {
		Matchers string `json:"matchers"`
	} `json:"scope,omitempty"`
}

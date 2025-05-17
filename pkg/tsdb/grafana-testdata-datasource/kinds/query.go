package kinds

import (
	"embed"
	"encoding/json"
)

// NodesQueryType defines model for NodesQuery.Type.
// +enum
type NodesQueryType string

const (
	NodesQueryTypeRandom          NodesQueryType = "random"
	NodesQueryTypeRandomEdges     NodesQueryType = "random edges"
	NodesQueryTypeResponseMedium  NodesQueryType = "response_medium"
	NodesQueryTypeResponseSmall   NodesQueryType = "response_small"
	NodesQueryTypeFeatureShowcase NodesQueryType = "feature_showcase"
)

// StreamingQueryType defines model for StreamingQuery.Type.
// +enum
type StreamingQueryType string

const (
	StreamingQueryTypeFetch  StreamingQueryType = "fetch"
	StreamingQueryTypeLogs   StreamingQueryType = "logs"
	StreamingQueryTypeSignal StreamingQueryType = "signal"
	StreamingQueryTypeTraces StreamingQueryType = "traces"
)

// ErrorType defines model for TestDataQuery.ErrorType.
// +enum
type ErrorType string

const (
	ErrorTypeFrontendException  ErrorType = "frontend_exception"
	ErrorTypeFrontendObservable ErrorType = "frontend_observable"
	ErrorTypeServerPanic        ErrorType = "server_panic"
)

// ErrorSource defines model for TestDataQuery.ErrorSource.
// +enum
type ErrorSource string

// Defines values for ErrorSource.
const (
	ErrorSourcePlugin     ErrorSource = "plugin"
	ErrorSourceDownstream ErrorSource = "downstream"
)

// TestDataQueryType defines model for TestDataQueryType.
// +enum
type TestDataQueryType string

// Defines values for TestDataQueryType.
const (
	TestDataQueryTypeAnnotations                  TestDataQueryType = "annotations"
	TestDataQueryTypeArrow                        TestDataQueryType = "arrow"
	TestDataQueryTypeCsvContent                   TestDataQueryType = "csv_content"
	TestDataQueryTypeCsvFile                      TestDataQueryType = "csv_file"
	TestDataQueryTypeCsvMetricValues              TestDataQueryType = "csv_metric_values"
	TestDataQueryTypeDatapointsOutsideRange       TestDataQueryType = "datapoints_outside_range"
	TestDataQueryTypeErrorWithSource              TestDataQueryType = "error_with_source"
	TestDataQueryTypeExponentialHeatmapBucketData TestDataQueryType = "exponential_heatmap_bucket_data"
	TestDataQueryTypeFlameGraph                   TestDataQueryType = "flame_graph"
	TestDataQueryTypeGrafanaApi                   TestDataQueryType = "grafana_api"
	TestDataQueryTypeLinearHeatmapBucketData      TestDataQueryType = "linear_heatmap_bucket_data"
	TestDataQueryTypeLive                         TestDataQueryType = "live"
	TestDataQueryTypeLogs                         TestDataQueryType = "logs"
	TestDataQueryTypeManualEntry                  TestDataQueryType = "manual_entry"
	TestDataQueryTypeNoDataPoints                 TestDataQueryType = "no_data_points"
	TestDataQueryTypeNodeGraph                    TestDataQueryType = "node_graph"
	TestDataQueryTypePredictableCsvWave           TestDataQueryType = "predictable_csv_wave"
	TestDataQueryTypePredictablePulse             TestDataQueryType = "predictable_pulse"
	TestDataQueryTypeRandomWalk                   TestDataQueryType = "random_walk"
	TestDataQueryTypeRandomWalkTable              TestDataQueryType = "random_walk_table"
	TestDataQueryTypeRandomWalkWithError          TestDataQueryType = "random_walk_with_error"
	TestDataQueryTypeRawFrame                     TestDataQueryType = "raw_frame"
	TestDataQueryTypeServerError500               TestDataQueryType = "server_error_500"
	TestDataQueryTypeSteps                        TestDataQueryType = "steps"
	TestDataQueryTypeSimulation                   TestDataQueryType = "simulation"
	TestDataQueryTypeSlowQuery                    TestDataQueryType = "slow_query"
	TestDataQueryTypeStreamingClient              TestDataQueryType = "streaming_client"
	TestDataQueryTypeTableStatic                  TestDataQueryType = "table_static"
	TestDataQueryTypeTrace                        TestDataQueryType = "trace"
	TestDataQueryTypeUsa                          TestDataQueryType = "usa"
	TestDataQueryTypeVariablesQuery               TestDataQueryType = "variables-query"
)

// TestDataQuery defines model for TestDataQuery.
type TestDataQuery struct {
	ScenarioId TestDataQueryType `json:"scenarioId,omitempty"`
	Alias      string            `json:"alias,omitempty"`
	Labels     string            `json:"labels,omitempty"`

	// common parameter used by many query types
	StringInput string `json:"stringInput,omitempty"`

	CsvContent  string    `json:"csvContent,omitempty"`
	CsvFileName string    `json:"csvFileName,omitempty"`
	CsvWave     []CSVWave `json:"csvWave,omitempty"`

	// Used for live query
	Channel string `json:"channel,omitempty"`

	// Drop percentage (the chance we will lose a point 0-100)
	DropPercent     float64     `json:"dropPercent,omitempty"`
	ErrorType       ErrorType   `json:"errorType,omitempty"`
	FlamegraphDiff  bool        `json:"flamegraphDiff,omitempty"`
	LevelColumn     bool        `json:"levelColumn,omitempty"`
	StartValue      float64     `json:"startValue,omitempty"`
	Spread          float64     `json:"spread,omitempty"`
	Noise           float64     `json:"noise,omitempty"`
	Min             *float64    `json:"min,omitempty"`
	Max             *float64    `json:"max,omitempty"`
	WithNil         bool        `json:"withNil,omitempty"`
	Lines           int64       `json:"lines,omitempty"`
	Points          [][]any     `json:"points,omitempty"`
	RawFrameContent string      `json:"rawFrameContent,omitempty"`
	SeriesCount     int         `json:"seriesCount,omitempty"`
	SpanCount       int         `json:"spanCount,omitempty"`
	ErrorSource     ErrorSource `json:"errorSource,omitempty"`

	Nodes     *NodesQuery      `json:"nodes,omitempty"`
	PulseWave *PulseWaveQuery  `json:"pulseWave,omitempty"`
	Sim       *SimulationQuery `json:"sim,omitempty"`
	Stream    *StreamingQuery  `json:"stream,omitempty"`
	Usa       *USAQuery        `json:"usa,omitempty"`
}

// CSVWave defines model for CSVWave.
type CSVWave struct {
	TimeStep  int64  `json:"timeStep,omitempty"`
	ValuesCSV string `json:"valuesCSV,omitempty"`
	Labels    string `json:"labels,omitempty"`
	Name      string `json:"name,omitempty"`
}

// NodesQuery defines model for NodesQuery.
type NodesQuery struct {
	Count int64          `json:"count,omitempty"`
	Seed  int64          `json:"seed,omitempty"`
	Type  NodesQueryType `json:"type,omitempty"`
}

// PulseWaveQuery defines model for PulseWaveQuery.
type PulseWaveQuery struct {
	OffCount int64   `json:"offCount,omitempty"`
	OffValue float64 `json:"offValue,omitempty"`
	OnCount  int64   `json:"onCount,omitempty"`
	OnValue  float64 `json:"onValue,omitempty"`
	TimeStep int64   `json:"timeStep,omitempty"`
}

// SimulationQuery defines model for SimulationQuery.
type SimulationQuery struct {
	Config map[string]any `json:"config,omitempty"`
	Key    struct {
		Tick float64 `json:"tick"`
		Type string  `json:"type"`
		Uid  *string `json:"uid,omitempty"`
	} `json:"key"`
	Last   bool `json:"last,omitempty"`
	Stream bool `json:"stream,omitempty"`
}

// StreamingQuery defines model for StreamingQuery.
type StreamingQuery struct {
	Bands  int32              `json:"bands,omitempty"`
	Noise  float64            `json:"noise"`
	Speed  float64            `json:"speed"`
	Spread float64            `json:"spread"`
	Type   StreamingQueryType `json:"type"`
	Url    string             `json:"url,omitempty"`
}

// USAQuery defines model for USAQuery.
type USAQuery struct {
	Fields []string `json:"fields,omitempty"`
	Mode   string   `json:"mode,omitempty"`
	Period string   `json:"period,omitempty"`
	States []string `json:"states,omitempty"`
}

//go:embed query.types.json
var f embed.FS

// QueryTypeDefinitionListJSON returns the query type definitions
func QueryTypeDefinitionListJSON() (json.RawMessage, error) {
	return f.ReadFile("query.types.json")
}

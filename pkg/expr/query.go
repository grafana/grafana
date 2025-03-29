package expr

import (
	"embed"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// Supported expression types
// +enum
type QueryType string

const (
	// Apply a mathematical expression to results
	QueryTypeMath QueryType = "math"

	// Reduce query results
	QueryTypeReduce QueryType = "reduce"

	// Resample query results
	QueryTypeResample QueryType = "resample"

	// Classic query
	QueryTypeClassic QueryType = "classic_conditions"

	// Threshold
	QueryTypeThreshold QueryType = "threshold"

	// SQL query via DuckDB
	QueryTypeSQL QueryType = "sql"
)

type MathQuery struct {
	// General math expression
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A + 1,example=$A/$B"`
}

type ReduceQuery struct {
	// Reference to single query result
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A"`

	// The reducer
	Reducer mathexp.ReducerID `json:"reducer"`

	// Reducer Options
	Settings *ReduceSettings `json:"settings,omitempty"`
}

// QueryType = resample
type ResampleQuery struct {
	// The math expression
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A + 1,example=$A"`

	// The time duration
	Window string `json:"window" jsonschema:"minLength=1,example=1d,example=10m"`

	// The downsample function
	Downsampler mathexp.ReducerID `json:"downsampler"`

	// The upsample function
	Upsampler mathexp.Upsampler `json:"upsampler"`
}

type ThresholdQuery struct {
	// Reference to single query result
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A"`

	// Threshold Conditions
	Conditions []ThresholdConditionJSON `json:"conditions"`
}

type ClassicQuery struct {
	Conditions []classic.ConditionJSON `json:"conditions"`
}

// SQLQuery requires the sqlExpression feature flag
type SQLExpression struct {
	Expression string `json:"expression" jsonschema:"minLength=1,example=SELECT * FROM A LIMIT 1"`
	Format     string `json:"format"`
}

//-------------------------------
// Non-query commands
//-------------------------------

type ReduceSettings struct {
	// Non-number reduce behavior
	Mode ReduceMode `json:"mode"`

	// Only valid when mode is replace
	ReplaceWithValue *float64 `json:"replaceWithValue,omitempty"`
}

// Non-Number behavior mode
// +enum
type ReduceMode string

const (
	// Default mode
	ReduceModeStrict = ""

	// Drop non-numbers
	ReduceModeDrop ReduceMode = "dropNN"

	// Replace non-numbers
	ReduceModeReplace ReduceMode = "replaceNN"
)

//go:embed query.types.json
var f embed.FS

func QueryTypeDefinitionListJSON() ([]byte, error) {
	return f.ReadFile("query.types.json")
}

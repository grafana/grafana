package expressions

// QueryType = reduce
type ReduceQueryTypeProperties struct {
	// Reference to other query results
	Expression string `json:"expression"`

	// The reducer
	Reducer string `json:"reducer"`

	// Reducer Options
	Settings ReduceSettings `json:"settings"`
}

type ReduceSettings struct {
	// Non-number reduce behavior
	Mode ReduceMode `json:"mode"`

	// Only valid when mode is replace
	ReplaceWithValue *float64 `json:"replaceWithValue,omitempty"`
}

// Non-Number behavior mode
type ReduceMode string

const (
	// Drop non-numbers
	ReduceModeDrop ReduceMode = "dropNN"

	// Replace non-numbers
	ReduceModeReplace ReduceMode = "replaceNN"
)

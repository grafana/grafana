package expr

var _ ExpressionQuery = (*ReduceQuery)(nil)

type ReduceQuery struct {
	// Reference to other query results
	Expression string `json:"expression"`

	// The reducer
	Reducer ReducerID `json:"reducer"`

	// Reducer Options
	Settings ReduceSettings `json:"settings"`
}

func (*ReduceQuery) ExpressionQueryType() QueryType {
	return QueryTypeReduce
}

func (q *ReduceQuery) Variables() []string {
	return []string{q.Expression}
}

type ReduceSettings struct {
	// Non-number reduce behavior
	Mode ReduceMode `json:"mode"`

	// Only valid when mode is replace
	ReplaceWithValue *float64 `json:"replaceWithValue,omitempty"`
}

// The reducer function
// +enum
type ReducerID string

const (
	ReducerSum   ReducerID = "sum"
	ReducerMean  ReducerID = "mean"
	ReducerMin   ReducerID = "min"
	ReducerMax   ReducerID = "max"
	ReducerCount ReducerID = "count"
	ReducerLast  ReducerID = "last"
)

// Non-Number behavior mode
// +enum
type ReduceMode string

const (
	// Drop non-numbers
	ReduceModeDrop ReduceMode = "dropNN"

	// Replace non-numbers
	ReduceModeReplace ReduceMode = "replaceNN"
)

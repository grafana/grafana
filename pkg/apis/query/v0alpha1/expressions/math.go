package expressions

// QueryType = math
type MathQueryTypeProperties struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId,omitempty"`

	// QueryType must equal "math"
	QueryType string `json:"queryType,omitempty"`

	// General math expression
	Expression string `json:"expression"`
}

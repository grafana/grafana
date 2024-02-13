package expr

// QueryType = resample
type ResampleQuery struct {
	// The math expression
	Expression string `json:"expression"`

	// The math expression
	Window string `json:"window"`

	// The reducer
	Downsampler string `json:"downsampler"`

	// The reducer
	Upsampler string `json:"upsampler"`
}

func (*ResampleQuery) ExpressionQueryType() QueryType {
	return QueryTypeReduce
}

func (q *ResampleQuery) Variables() []string {
	return []string{q.Expression}
}

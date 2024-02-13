package expr

// QueryType = resample
type ResampleQuery struct {
	// The math expression
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A + 1,example=$A"`

	// The time durration
	Window string `json:"window" jsonschema:"minLength=1,example=1w,example=10m"`

	// The downsample function
	Downsampler string `json:"downsampler"`

	// The upsample function
	Upsampler string `json:"upsampler"`
}

func (*ResampleQuery) ExpressionQueryType() QueryType {
	return QueryTypeReduce
}

func (q *ResampleQuery) Variables() []string {
	return []string{q.Expression}
}

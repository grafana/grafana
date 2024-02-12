package expressions

import query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"

// QueryType = resample
type ResampleQueryTypeProperties struct {
	query.CommonQueryProperties `json:",inline"`

	// The math expression
	Expression string `json:"expression"`

	// The math expression
	Window string `json:"window"`

	// The reducer
	Downsampler string `json:"downsampler"`

	// The reducer
	Upsampler string `json:"upsampler"`
}

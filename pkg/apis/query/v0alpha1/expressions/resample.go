package expressions

// QueryType = resample
type ResampleQueryTypeProperties struct {
	// The math expression
	Expression string `json:"expression"`

	// The math expression
	Window string `json:"window"`

	// The reducer
	Downsampler string `json:"downsampler"`

	// The reducer
	Upsampler string `json:"upsampler"`
}

package kindsys

// Raw is a category of Kind that specifies handling for a raw file,
// like an image, or an svg or parquet file. Grafana mostly acts as asset storage for raw
// kinds: the byte sequence is a black box to Grafana, and type is determined
// through metadata such as file extension.
#Raw: {
	_sharedKind
	form: "raw"

	// TODO docs
	extensions?: [...string]

	lineageIsGroup: false

	maturity: *"experimental" | "mature" // TODO unclear if we want maturity for raw kinds

	// known TODOs
	// - sanitize function
	// - get summary
}

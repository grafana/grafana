package targets

#Prometheus: {
	// Query expression.
	expr: string
	// Controls the name of the time series, using name or pattern.
	legendFormat?: string
	// Interval.
	interval?: int | *1
	// Target reference ID.
	refId: string
	// Perform an “instant” query, to return only the latest value that
	// Prometheus has scraped for the requested time series.
	instant: bool | *false
	// Resolution.
	intervalFactor?: int
	// Format.
	format: *"time_series" | "table" | "heat_map"
}

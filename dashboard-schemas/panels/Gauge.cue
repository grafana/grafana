package panels

// Gauge is a single value panel that can repeat a gauge for every series,
// column or row.
#Gauge: _panel & {
	// Field config.
	fieldConfig: {
		// Defaults.
		defaults: {
			// Custom.
			custom: {}
			// Unit.
			unit: string
			// Min.
			min: int
			// Max.
			max: int
			// Decimals.
			decimals: int
			// Change the field or series name.
			displayName: string
			// What to show when there is no value.
			noValue: string
			// Threshold config.
			thresholds: _thresholds
			// Mappings.
			mappings: [..._mapping]
			// Data Links.
			links: [..._dataLink]
		}
		// Overrides.
		overrides: [..._override]
	}
	// Options.
	options: {
		// Reduce options.
		reduceOptions: {
			// * `true` - Show a calculated value based on all rows.
			// * `false` - Show a separate stat for every row.
			values: bool | *false
			// If values is false, sets max number of rows to
			// display.
			limit: int
			// Reducer function/calculation.
			calcs: [
				"allIsZero",
				"allIsNull",
				"changeCount",
				"count",
				"delta",
				"diff",
				"distinctCount",
				"first",
				"firstNotNull",
				"lastNotNull",
				"last",
				"logmin",
				"max",
				"min",
				"range",
				"step",
				"sum",
			] | *["mean"]
			// Fields that should be included in the panel.
			fields: string | *""
		}
		// Render the threshold values around the gauge bar.
		showThresholdLabels: bool | *false
		// Render the thresholds as an outer bar.
		showThresholdMarkers: bool | *true
	}
	// Panel type.
	type: string | *"gauge"
}

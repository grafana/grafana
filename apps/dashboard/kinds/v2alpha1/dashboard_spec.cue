package v2alpha1

DashboardSpec: {
	mappings?: [...ValueMapping]
}

ValueMapping: ValueMap | RangeMap

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
MappingType: "value" | "range" | "regex" | "special"

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
ValueMap: {
	type: MappingType & "value"
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	options: [string]: ValueMappingResult
}

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
RangeMap: {
	type: MappingType & "range"
	// Range to match against and the result to apply when the value is within the range
	options: {
		// Min value of the range. It can be null which means -Infinity
		from: float64 | null
		// Max value of the range. It can be null which means +Infinity
		to: float64 | null
		// Config to apply when the value is within the range
		result: ValueMappingResult
	}
}

// Result used as replacement with text and color when the value matches
ValueMappingResult: {
	// Text to display when the value matches
	text?: string
	// Text to use when the value matches
	color?: string
	// Icon to display when the value matches. Only specific visualizations.
	icon?: string
	// Position in the mapping array. Only used internally.
	index?: int32
}

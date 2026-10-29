package common

// Options for time comparison
TimeCompareOptions: {
	// Enable time comparison control
	timeCompare?: bool
	// How the tooltip delta between the current and comparison values is colored
	colorMode?: TimeCompareColorMode
} @cuetsy(kind="interface")

// Colors the tooltip delta between the current and comparison values. "standard" colors an increase
// green, "inverted" colors an increase red, and "same_as_value" reuses the series color.
TimeCompareColorMode: "standard" | "inverted" | "same_as_value" @cuetsy(kind="enum",memberNames="Standard|Inverted|SameAsValue")

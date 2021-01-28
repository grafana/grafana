package variables

_variable: {
	// Currently selected value.
	current: {
		selected: bool | *false
		text:     string | [...string]
		value:    string | [...string]
	}
	// Whether to hide the label and variable.
	// * 0 - Show all.
	// * 1 - Hide label.
	// * 2 - Hide label and variable.
	hide: int >= 0 <= 2 | *0
	// Enable include all option.
	includeAll: bool | *false
	// When includeAll is enabled, this sets its value.
	allValue?: string
	// Optional display name.
	label?: string
	// Allows mutltiple values to be selected at the same time.
	multi: bool | *false
	// Variable name.
	name: string
	// Options for variable.
	options: [...{
		selected: bool
		text:     string
		value:    string
	}]
	// Skip URL sync.
	skipUrlSync: bool | *false
}

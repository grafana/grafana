package grafanaschema

//  Every property is optional
//  Plugins may extend this with additional  Something like series overrides
FieldConfig: {
	// The display value for this   This supports template variables blank is auto
	displayName?: string

	// This can be used by data sources that return and explicit naming structure for values and labels
	// When this property is configured, this value is used rather than the default naming 
	displayNameFromDS?: string

	// Human readable field metadata
	description?: string

	// An explict path to the field in the   When the frame meta includes a path,
	// This will default to `${metapath}/${name}
	//
	// When defined, this value can be used as an identifier within the datasource scope, and
	// may be used to update the results
	path?: string

	// True if data source can write a value to the   Auth/authz are supported separately
	writeable?: bool

	// True if data source field supports ad-hoc filters
	filterable?: bool

	// Numeric Options
	unit?: string

	// Significant digits (for display)
	decimals?: number | *null
	min?:      number | null
	max?:      number | null

	// Alternative to empty string
	noValue?: string

	// Panel Specific Values
	custom?: {}
} @cuetsy(targetType="interface")

// Defines 
FieldConfigSource: {
	// Defaults applied to all numeric fields
	defaults: FieldConfig

	// Rules to override individual values
	overrides: [ConfigOverrideRule]
} @cuetsy(targetType="interface")
DynamicConfigValue: {
	id: string | *""
	value?: {}
} @cuetsy(targetType="interface")
MatcherConfig: {
	id: string | *""
	options?: {}
} @cuetsy(targetType="interface")
ConfigOverrideRule: {
	matcher: MatcherConfig
	properties: [DynamicConfigValue]
} @cuetsy(targetType="interface")

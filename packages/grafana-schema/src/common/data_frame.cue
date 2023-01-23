package common

//  See also:
//  https://github.com/grafana/grafana-plugin-sdk-go/blob/main/data/frame_type.go
DataFrameType:
		"timeseries-wide" |
		"timeseries-long" |
		 // @deprecated in favor of TimeSeriesMulti
		"timeseries-many" |
		"timeseries-multi" |
		// Directory listing
		"directory-listing" |
		// First field is X, the rest are ordinal values used as rows in the heatmap
		"heatmap-rows" |
		//Explicit fields for xMin, yMin, count, ...
		//All values in the grid exist and have regular spacing
		//If the y value is actually ordinal, use `meta.custom` to specify the bucket lookup values
		"heatmap-cells" |
		//Explicit fields for xMin, xMax, count
		"histogram" @cuetsy(kind="enum", memberNames="TimeSeriesWide|TimeSeriesLong|TimeSeriesMany|TimeSeriesMulti|DirectoryListing|HeatmapRows|HeatmapCells|Histogram")

// TODO docs
DataFrame: {
	QueryResultBase
  name?: string
  // All fields of equal length
  fields: [...#Field]
  // The number of rows
  length: int64
} @cuetsy(kind="interface")

// TODO Field<T = any, V = Vector<T>>
#Field: {
		//Name of the field (column)
		name: string
		// Field value type (string, number, etc)
		type: #FieldType
		// Meta info about how field and how to display it
		config: #FieldConfig
		// The raw field values. Extended in veneer
		values: {...}
		labels?: Labels
		// Cached values with appropriate display and id values TODO | null
		state?: #FieldState
		// Convert a value for display TODO extend in veneer
		display?: _
		// Get value data links with variables interpolated. Extended in veneer
		getLinks?: _
} @cuetsy(kind="interface")

#FieldType:
		// Or date
		"time" |
		"number" |
		"string" |
		"bool" |
		// Used to detect that the value is some kind of trace data to help with the visualisation and processing.
		"trace" |
		"geo" |
		// Object, Array, etc
		"other" @cuetsy(kind="enum", memberNames="time|number|string|bool|trace|geo|other")

// Every property is optional
// Plugins may extend this with additional properties. Something like series overrides
#FieldConfig: {
		// The display value for this field.  This supports template variables blank is auto
		displayName?: string
		// This can be used by data sources that return and explicit naming structure for values and labels
		// When this property is configured, this value is used rather than the default naming strategy.
		displayNameFromDS?: string
		// Human readable field metadata
		description?: string
		// An explict path to the field in the datasource.  When the frame meta includes a path,
		// This will default to `${frame.meta.path}/${field.name}
		// When defined, this value can be used as an identifier within the datasource scope, and
		// may be used to update the results
		path?: string
		// True if data source can write a value to the path.  Auth/authz are supported separately
		writeable?: bool
		// True if data source field supports ad-hoc filters
		filterable?: bool
		// Numeric Options
		unit?: string
		// Significant digits (for display) TODO this should be a separate type
		decimals?: int64
		// TODO | null
		min?: int64
		// TODO | null
		max?: int64
		// Interval indicates the expected regular step between values in the series.
		// When an interval exists, consumers can identify "missing" values when the expected value is not present.
		// The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
		// The interval uses the same units as the values.  For time.Time, this is defined in milliseconds.
		// TODO | null
		interval?: int64
		// Convert input values into a display string
		mappings?: [...#ValueMapping]
		// Map numeric values to states
		thresholds?: [...#ThresholdsConfig]
} @cuetsy(kind="interface")

// TODO this doesn't work
//#DecimalCount?: int64 | null @cuetsy(kind="type")

#FieldState: {
		// An appropriate name for the field (does not include frame info) TODO | null
		displayName?: string
		//Cache of reduced values
		calcs?: #FieldCalcs
		// The numeric range for values in this field.  This value will respect the min/max
		// set in field config, or when set to `auto` this will have the min/max for all data
		// in the response
		range?: #NumericRange
		// Appropriate values for templating
		scopedVars?: ScopedVars
		// Series index is index for this field in a larger data set that can span multiple DataFrames
		// Useful for assigning color to series by looking up a color in a palette using this index
		seriesIndex?: int64
		// Location of this field within the context frames results
		// @internal -- we will try to make this unnecessary
		origin?: #DataFrameFieldIndex
		// Boolean value is true if field is in a larger data set with multiple frames.
		// This is only related to the cached displayName property above.
		multipleFrames?: bool
		// Boolean value is true if a null filling threshold has been applied
		// against the frame of the field. This is used to avoid cases in which
		// this would applied more than one time.
		nullThresholdApplied?: bool
} @cuetsy(kind="interface")

// TODO Docs
#FieldCalcs: {...}

// TODO docs
#NumericRange: {
		min?: int64 // TODO | null
		max?: int64 // TODO | null
		delta: int64
} @cuetsy(kind="interface")

#DataFrameFieldIndex: {
		frameIndex: int64
		fieldIndex: int64
} @cuetsy(kind="interface")

// TODO Duplicate declaration
#ThresholdsConfig: {
	mode: #ThresholdsMode @grafanamaturity(NeedsExpertReview)
	// Must be sorted by 'value', first value is always -Infinity
	steps: [...#Threshold] @grafanamaturity(NeedsExpertReview)
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

// TODO Duplicate declaration
#Threshold: {
	// TODO docs
	// FIXME the corresponding typescript field is required/non-optional, but nulls currently appear here when serializing -Infinity to JSON
	value?: int64 @grafanamaturity(NeedsExpertReview)
	// TODO docs
	color: string @grafanamaturity(NeedsExpertReview)
	// TODO docs
	// TODO are the values here enumerable into a disjunction?
	// Some seem to be listed in typescript comment
	state?: string @grafanamaturity(NeedsExpertReview)
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

// TODO Duplicate declaration
#ThresholdsMode: "absolute" | "percentage" @cuetsy(kind="enum") @grafanamaturity(NeedsExpertReview)

// TODO docs | Duplicate declaration
#ValueMapping: #ValueMap | #RangeMap | #RegexMap | #SpecialValueMap @cuetsy(kind="type") @grafanamaturity(NeedsExpertReview)

// TODO docs | Duplicate declaration
#MappingType: "value" | "range" | "regex" | "special" @cuetsy(kind="enum",memberNames="ValueToText|RangeToText|RegexToText|SpecialValue") @grafanamaturity(NeedsExpertReview)

// TODO docs | Duplicate declaration
#ValueMap: {
	type: #MappingType & "value"
	options: [string]: #ValueMappingResult
} @cuetsy(kind="interface")

// TODO docs | Duplicate declaration
#RangeMap: {
		type: #MappingType & "range"
		options: {
				// to and from are `number | null` in current ts, really not sure what to do
				from:   float64 @grafanamaturity(NeedsExpertReview)
				to:     float64 @grafanamaturity(NeedsExpertReview)
				result: #ValueMappingResult
		}
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

// TODO docs | Duplicate declaration
#RegexMap: {
		type: #MappingType & "regex"
		options: {
				pattern: string
				result:  #ValueMappingResult
		}
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

// TODO docs | Duplicate declaration
#SpecialValueMap: {
		type: #MappingType & "special"
		options: {
		match:   "true" | "false"
		pattern: string
		result:  #ValueMappingResult
		}
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

//TODO duplicate
#ValueMappingResult: {
		text?:  string
		color?: string
		icon?:  string
		index?: int32
} @cuetsy(kind="interface")

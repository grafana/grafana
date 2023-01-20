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


// TODO extends #QueryResultBase
DataFrame: {
  name?: string
  // All fields of equal length
  fields: [...#Field]

  // The number of rows
  length: number
}

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
  state?: FieldState
   // Convert a value for display
    display?: DisplayProcessor
   // Get value data links with variables interpolated. Extended in veneer
  getLinks?: _
}

#FieldType:
		// Or date
		"time" |
		"number" |
		"string" |
		"boolean" |
		// Used to detect that the value is some kind of trace data to help with the visualisation and processing.
		"trace" |
		"geo" |
		// Object, Array, etc
		"other" @cuetsy(kind="enum", memberNames="time|number|string|boolean|trace|geo|other")

// Every property is optional
// Plugins may extend this with additional properties. Something like series overrides
FieldConfig: {
// The display value for this field.  This supports template variables blank is auto
displayName?: string
// This can be used by data sources that return and explicit naming structure for values and labels
// When this property is configured, this value is used rather than the default naming strategy.
displayNameFromDS?: string
// Human readable field metadata
description?: string
//An explict path to the field in the datasource.  When the frame meta includes a path,
//This will default to `${frame.meta.path}/${field.name}
// When defined, this value can be used as an identifier within the datasource scope, and
// may be used to update the results
path?: string
// True if data source can write a value to the path.  Auth/authz are supported separately
writeable?: bool
// True if data source field supports ad-hoc filters
filterable?: bool
 // Numeric Options
unit?: string
// Significant digits (for display)
  decimals?: DecimalCount
  // TODO | null
  min?: number
    // TODO | null
  max?: number
    // Interval indicates the expected regular step between values in the series.
  // When an interval exists, consumers can identify "missing" values when the expected value is not present.
  // The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
  // The interval uses the same units as the values.  For time.Time, this is defined in milliseconds.
  // TODO | null
  interval?: number
    // Convert input values into a display string
  mappings?: [...ValueMapping]
    // Map numeric values to states
  thresholds?: [#ThresholdsConfig]
}

// TODO Duplicate declaration
#ThresholdsConfig: {
	mode: #ThresholdsMode @grafanamaturity(NeedsExpertReview)

	// Must be sorted by 'value', first value is always -Infinity
	steps: [...#Threshold] @grafanamaturity(NeedsExpertReview)
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)
// TODO Duplicate declaration
#ThresholdsMode: "absolute" | "percentage" @cuetsy(kind="enum") @grafanamaturity(NeedsExpertReview)

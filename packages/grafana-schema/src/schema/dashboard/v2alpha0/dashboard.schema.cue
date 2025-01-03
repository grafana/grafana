package v2alpha0

import (
	"github.com/grafana/grafana/packages/grafana-schema/src/common"
)

DashboardV2Spec: {
  // Unique numeric identifier for the dashboard.
  // `id` is internal to a specific Grafana instance. `uid` should be used to identify a dashboard across Grafana instances.
  id?: int64

  // Title of dashboard.
  title: string

  // Description of dashboard.
  description?: string

  // Configuration of dashboard cursor sync behavior.
  // "Off" for no shared crosshair or tooltip (default).
  // "Crosshair" for shared crosshair.
  // "Tooltip" for shared crosshair AND shared tooltip.
  cursorSync: DashboardCursorSync

  // When set to true, the dashboard will redraw panels at an interval matching the pixel width.
  // This will keep data "moving left" regardless of the query refresh rate. This setting helps
  // avoid dashboards presenting stale live data.
  liveNow?: bool

  // When set to true, the dashboard will load all panels in the dashboard when it's loaded.
  preload: bool

  // Whether a dashboard is editable or not.
  editable?: bool | *true

  // Links with references to other dashboards or external websites.
  links: [...DashboardLink]

  // Tags associated with dashboard.
  tags: [...string]

  timeSettings: TimeSettingsSpec

  // Configured template variables.
  variables: [...VariableKind]

  elements: [ElementReference.name]: PanelKind // |* more element types in the future

  annotations: [...AnnotationQueryKind]

  layout: GridLayoutKind

  // Version of the JSON schema, incremented each time a Grafana update brings
  // changes to said schema.
  schemaVersion: uint16 | *39

  // Plugins only. The version of the dashboard installed together with the plugin.
  // This is used to determine if the dashboard should be updated when the plugin is updated.
  revision?: uint16
}


AnnotationPanelFilter: {
  // Should the specified panels be included or excluded
  exclude?: bool | *false

  // Panel IDs that should be included or excluded
  ids: [...uint8]
}

// "Off" for no shared crosshair or tooltip (default).
// "Crosshair" for shared crosshair.
// "Tooltip" for shared crosshair AND shared tooltip.
DashboardCursorSync: "Off" | "Crosshair" | "Tooltip"

// Links with references to other dashboards or external resources
DashboardLink: {
  // Title to display with the link
  title: string
  // Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
  // FIXME: The type is generated as `type: DashboardLinkType | dashboardLinkType.Link;` but it should be `type: DashboardLinkType`
  type: DashboardLinkType
  // Icon name to be displayed with the link
  icon: string
  // Tooltip to display when the user hovers their mouse over it
  tooltip: string
  // Link URL. Only required/valid if the type is link
  url?: string
  // List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards
  tags: [...string]
  // If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards
  asDropdown: bool | *false
  // If true, the link will be opened in a new tab
  targetBlank: bool | *false
  // If true, includes current template variables values in the link as query params
  includeVars: bool | *false
  // If true, includes current time range in the link as query params
  keepTime: bool | *false
}

DataSourceRef: {
  // The plugin type-id
  type?: string

  // Specific datasource instance
  uid?: string
}

// Transformations allow to manipulate data returned by a query before the system applies a visualization.
// Using transformations you can: rename fields, join time series data, perform mathematical operations across queries,
// use the output of one transformation as the input to another transformation, etc.
DataTransformerConfig: {
  // Unique identifier of transformer
  id: string
  // Disabled transformations are skipped
  disabled?: bool
  // Optional frame matcher. When missing it will be applied to all results
  filter?: MatcherConfig
  // Where to pull DataFrames from as input to transformation
  topic?: common.DataTopic
  // Options to be passed to the transformer
  // Valid options depend on the transformer id
  options: _
}

DataLink: {
  title: string
  url: string
  targetBlank?: bool
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
FieldConfigSource: {
  // Defaults are the options applied to all fields.
  defaults: FieldConfig
  // Overrides are the options applied to specific fields overriding the defaults.
  overrides: [...{
    matcher: MatcherConfig
    properties: [...DynamicConfigValue]
  }]
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
FieldConfig: {
  // The display value for this field.  This supports template variables blank is auto
  displayName?: string

  // This can be used by data sources that return and explicit naming structure for values and labels
  // When this property is configured, this value is used rather than the default naming strategy.
  displayNameFromDS?: string

  // Human readable field metadata
  description?: string

  // An explicit path to the field in the datasource.  When the frame meta includes a path,
  // This will default to `${frame.meta.path}/${field.name}
  //
  // When defined, this value can be used as an identifier within the datasource scope, and
  // may be used to update the results
  path?: string

  // True if data source can write a value to the path. Auth/authz are supported separately
  writeable?: bool

  // True if data source field supports ad-hoc filters
  filterable?: bool

  // Unit a field should use. The unit you select is applied to all fields except time.
  // You can use the units ID availables in Grafana or a custom unit.
  // Available units in Grafana: https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts
  // As custom unit, you can use the following formats:
  // `suffix:<suffix>` for custom unit that should go after value.
  // `prefix:<prefix>` for custom unit that should go before value.
  // `time:<format>` For custom date time formats type for example `time:YYYY-MM-DD`.
  // `si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that SI scale character.
  // `count:<unit>` for a custom count unit.
  // `currency:<unit>` for custom a currency unit.
  unit?: string

  // Specify the number of decimals Grafana includes in the rendered value.
  // If you leave this field blank, Grafana automatically truncates the number of decimals based on the value.
  // For example 1.1234 will display as 1.12 and 100.456 will display as 100.
  // To display all decimals, set the unit to `String`.
  decimals?: number

  // The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
  min?: number
  // The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
  max?: number

  // Convert input values into a display string
  mappings?: [...ValueMapping]

  // Map numeric values to states
  thresholds?: ThresholdsConfig

  // Panel color configuration
  color?: FieldColor

  // The behavior when clicking on a result
  links?: [...]

  // Alternative to empty string
  noValue?: string

  // custom is specified by the FieldConfig field
  // in panel plugin schemas.
  custom?: {...}
}

DynamicConfigValue: {
  id: string | *""
  value?: _
}

// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
MatcherConfig: {
  // The matcher id. This is used to find the matcher implementation from registry.
  id: string | *""
  // The matcher options. This is specific to the matcher implementation.
  options?: _
}

Threshold: {
  value: number
  color: string
}

ThresholdsMode: "absolute" | "percentage"

ThresholdsConfig: {
  mode: ThresholdsMode
  steps: [...Threshold]
}

ValueMapping: ValueMap | RangeMap | RegexMap | SpecialValueMap

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
MappingType: "value" | "range" | "regex" | "special" @cog(kind="enum",memberNames="ValueToText|RangeToText|RegexToText|SpecialValue")

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

// Maps regular expressions to replacement text and a color.
// For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
RegexMap: {
  type: MappingType & "regex"
  // Regular expression to match against and the result to apply when the value matches the regex
  options: {
    // Regular expression to match against
    pattern: string
    // Config to apply when the value matches the regex
    result: ValueMappingResult
  }
}

// Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.
// See SpecialValueMatch to see the list of special values.
// For example, you can configure a special value mapping so that null values appear as N/A.
SpecialValueMap: {
  type: MappingType & "special"
  options: {
    // Special value to match against
    match: SpecialValueMatch
    // Config to apply when the value matches the special value
    result: ValueMappingResult
  }
}

// Special value types supported by the `SpecialValueMap`
SpecialValueMatch: "true" | "false" | "null" | "nan" | "null+nan" | "empty" @cog(kind="enum",memberNames="True|False|Null|NaN|NullAndNaN|Empty")

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

// Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
// Continuous color interpolates a color using the percentage of a value relative to min and max.
// Accepted values are:
// `thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold
// `palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations
// `palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations
// `continuous-GrYlRd`: ontinuous Green-Yellow-Red palette mode
// `continuous-RdYlGr`: Continuous Red-Yellow-Green palette mode
// `continuous-BlYlRd`: Continuous Blue-Yellow-Red palette mode
// `continuous-YlRd`: Continuous Yellow-Red palette mode
// `continuous-BlPu`: Continuous Blue-Purple palette mode
// `continuous-YlBl`: Continuous Yellow-Blue palette mode
// `continuous-blues`: Continuous Blue palette mode
// `continuous-reds`: Continuous Red palette mode
// `continuous-greens`: Continuous Green palette mode
// `continuous-purples`: Continuous Purple palette mode
// `shades`: Shades of a single color. Specify a single color, useful in an override rule.
// `fixed`: Fixed color mode. Specify a single color, useful in an override rule.
FieldColorModeId: "thresholds" | "palette-classic" | "palette-classic-by-name" | "continuous-GrYlRd" | "continuous-RdYlGr" | "continuous-BlYlRd" | "continuous-YlRd" | "continuous-BlPu" | "continuous-YlBl" | "continuous-blues" | "continuous-reds" | "continuous-greens" | "continuous-purples" | "fixed" | "shades"

// Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
FieldColorSeriesByMode: "min" | "max" | "last"

// Map a field to a color.
FieldColor: {
    // The main color scheme mode.
    mode: FieldColorModeId
    // The fixed color value for fixed or shades color modes.
    fixedColor?: string
    // Some visualizations need to know how to assign a series color from by value color schemes.
    seriesBy?: FieldColorSeriesByMode
}

// Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
DashboardLinkType: "link" | "dashboards"

// --- Common types ---
Kind: {
    kind: string,
    spec: _
    metadata?: _
}

// --- Kinds ---
VizConfigSpec: {
  pluginVersion: string
  options: [string]: _
  fieldConfig: FieldConfigSource
}

VizConfigKind: {
  // The kind of a VizConfigKind is the plugin ID
  kind: string
  spec: VizConfigSpec
}

AnnotationQuerySpec: {
  datasource?: DataSourceRef
  query?: DataQueryKind
  enable: bool
  hide: bool
  iconColor: string
  name: string
  builtIn?: bool | *false
  filter?: AnnotationPanelFilter
}

AnnotationQueryKind: {
  kind: "AnnotationQuery"
  spec: AnnotationQuerySpec
}

QueryOptionsSpec: {
  timeFrom?: string
  maxDataPoints?: int
  timeShift?: string
  queryCachingTTL?: int
  interval?: string
  cacheTimeout?: string
  hideTimeOverride?: bool
}

DataQueryKind: {
  // The kind of a DataQueryKind is the datasource type
  kind: string
  spec: [string]: _
}

PanelQuerySpec: {
  query: DataQueryKind
  datasource?: DataSourceRef

  refId: string
  hidden: bool
}

PanelQueryKind: {
  kind: "PanelQuery"
  spec: PanelQuerySpec
}

TransformationKind: {
  // The kind of a TransformationKind is the transformation ID
  kind: string
  spec: DataTransformerConfig
}

QueryGroupSpec: {
  queries: [...PanelQueryKind]
  transformations: [...TransformationKind]
  queryOptions: QueryOptionsSpec
}

QueryGroupKind: {
  kind: "QueryGroup"
  spec: QueryGroupSpec
}

// Time configuration
// It defines the default time config for the time picker, the refresh picker for the specific dashboard.
TimeSettingsSpec: {
  // Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc".
  timezone?: string | *"browser"
  // Start time range for dashboard.
  // Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
  from: string | *"now-6h"
  // End time range for dashboard.
  // Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
  to: string | *"now"
  // Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".
  autoRefresh: string // v1: refresh
  // Interval options available in the refresh picker dropdown.
  autoRefreshIntervals: [...string] | *["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"] // v1: timepicker.refresh_intervals
  // Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.
  quickRanges: [...string] | *["5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"] // v1: timepicker.time_options , not exposed in the UI
  // Whether timepicker is visible or not.
  hideTimepicker: bool // v1: timepicker.hidden
  // Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
  weekStart: string
  // The month that the fiscal year starts on. 0 = January, 11 = December
  fiscalYearStartMonth: int
  // Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
  nowDelay?: string // v1: timepicker.nowDelay
}

GridLayoutItemSpec: {
  x: int
  y: int
  width: int
  height: int
  element: ElementReference // reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
}

GridLayoutItemKind: {
  kind: "GridLayoutItem"
  spec: GridLayoutItemSpec
}

GridLayoutSpec: {
  items: [...GridLayoutItemKind]
}

GridLayoutKind: {
  kind: "GridLayout"
  spec: GridLayoutSpec
}

PanelSpec: {
  id: number
  title: string
  description: string
  links: [...DataLink]
  data: QueryGroupKind
  vizConfig: VizConfigKind
  transparent?: bool
}

PanelKind: {
  kind: "Panel"
  spec: PanelSpec
}

ElementReference: {
  kind: "ElementReference"
  name: string
}




// Start FIXME: variables - in CUE PR - this are things that should be added into the cue schema
// TODO: properties such as `hide`, `skipUrlSync`, `multi` are type boolean, and in the old schema they are conditional,
// should we make them conditional in the new schema as well? or should we make them required but default to false?

// Variable types
VariableValue: VariableValueSingle | [...VariableValueSingle]

VariableValueSingle: string | bool | number | CustomVariableValue

// Custom formatter variable
CustomFormatterVariable: {
  name: string
  type: VariableType
  multi: bool
  includeAll: bool
}

// Custom variable value
CustomVariableValue: {
  // The format name or function used in the expression
  formatter: *null | string | VariableCustomFormatterFn
}

// Custom formatter function
VariableCustomFormatterFn: {
  value: _
  legacyVariableModel: {
    name: string
    type: VariableType
    multi: bool
    includeAll: bool
  }
  legacyDefaultFormatter?: VariableCustomFormatterFn
}

// Dashboard variable type
		// `query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.
		// `adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).
		// `constant`: 	Define a hidden constant.
		// `datasource`: Quickly change the data source for an entire dashboard.
		// `interval`: Interval variables represent time spans.
		// `textbox`: Display a free text input field with an optional default value.
		// `custom`: Define the variable options manually using a comma-separated list.
		// `system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
VariableType: "query" | "adhoc" | "groupby" | "constant" | "datasource" | "interval" | "textbox" | "custom" |
			"system" | "snapshot"

VariableKind: QueryVariableKind  | TextVariableKind  | ConstantVariableKind  | DatasourceVariableKind  | IntervalVariableKind  | CustomVariableKind  | GroupByVariableKind  | AdhocVariableKind

// Sort variable options
// Accepted values are:
// `disabled`: No sorting
// `alphabeticalAsc`: Alphabetical ASC
// `alphabeticalDesc`: Alphabetical DESC
// `numericalAsc`: Numerical ASC
// `numericalDesc`: Numerical DESC
// `alphabeticalCaseInsensitiveAsc`: Alphabetical Case Insensitive ASC
// `alphabeticalCaseInsensitiveDesc`: Alphabetical Case Insensitive DESC
// `naturalAsc`: Natural ASC
// `naturalDesc`: Natural DESC
// VariableSort enum with default value
VariableSort: "disabled" | "alphabeticalAsc" | "alphabeticalDesc" | "numericalAsc" | "numericalDesc" | "alphabeticalCaseInsensitiveAsc" | "alphabeticalCaseInsensitiveDesc" | "naturalAsc" | "naturalDesc"

// Options to config when to refresh a variable
// `never`: Never refresh the variable
// `onDashboardLoad`: Queries the data source every time the dashboard loads.
// `onTimeRangeChanged`: Queries the data source when the dashboard time range changes.
VariableRefresh: *"never" | "onDashboardLoad" | "onTimeRangeChanged"

// Determine if the variable shows on dashboard
// Accepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing).
VariableHide: *"dontHide" | "hideLabel" | "hideVariable"


// FIXME: should we introduce this? --- Variable value option
VariableValueOption: {
  label: string
  value: VariableValueSingle
  group?: string
}

// Variable option specification
VariableOption: {
  // Whether the option is selected or not
  selected?: bool
  // Text to be displayed for the option
  text: string | [...string]
  // Value of the option
value: string | [...string]
}

// Query variable specification
QueryVariableSpec: {
  name: string | *""
  current: VariableOption | *{
    text: ""
    value: ""
  }
  label?: string
  hide: VariableHide
  refresh: VariableRefresh
  skipUrlSync: bool | *false
  description?: string
  datasource?: DataSourceRef
  query: string | DataQueryKind | *""
  regex: string | *""
  sort: VariableSort
  definition?: string
  options: [...VariableOption] | *[]
  multi: bool | *false
  includeAll: bool | *false
  allValue?: string
  placeholder?: string
}

// Query variable kind
QueryVariableKind: {
  kind: "QueryVariable"
  spec: QueryVariableSpec
}

// Text variable specification
TextVariableSpec: {
  name: string | *""
  current: VariableOption | *{
    text: ""
    value: ""
  }
  query: string | *""
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Text variable kind
TextVariableKind: {
  kind: "TextVariable"
  spec: TextVariableSpec
}

// Constant variable specification
ConstantVariableSpec: {
  name: string | *""
  query: string | *""
  current: VariableOption | *{
    text: ""
    value: ""
  }
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Constant variable kind
ConstantVariableKind: {
  kind: "ConstantVariable"
  spec: ConstantVariableSpec
}

// Datasource variable specification
DatasourceVariableSpec: {
  name: string | *""
  pluginId: string | *""
  refresh: VariableRefresh
  regex: string | *""
  current: VariableOption | *{
    text: ""
    value: ""
  }
  options: [...VariableOption] | *[]
  multi: bool | *false
  includeAll: bool | *false
  allValue?: string
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Datasource variable kind
DatasourceVariableKind: {
  kind: "DatasourceVariable"
  spec: DatasourceVariableSpec
}

// Interval variable specification
IntervalVariableSpec: {
  name: string | *""
  query: string | *""
  current: VariableOption | *{
    text: ""
    value: ""
  }
  options: [...VariableOption] | *[]
  auto: bool | *false
  auto_min: string | *""
  auto_count: int | *0
  refresh: VariableRefresh
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Interval variable kind
IntervalVariableKind: {
  kind: "IntervalVariable"
  spec: IntervalVariableSpec
}

// Custom variable specification
CustomVariableSpec: {
  name: string | *""
  query: string | *""
  current: VariableOption
  options: [...VariableOption] | *[]
  multi: bool | *false
  includeAll: bool | *false
  allValue?: string
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Custom variable kind
CustomVariableKind: {
  kind: "CustomVariable"
  spec: CustomVariableSpec
}

// GroupBy variable specification
GroupByVariableSpec: {
  name: string | *""
  datasource?: DataSourceRef
  current: VariableOption | *{
    text: ""
    value: ""
  }
  options: [...VariableOption] | *[]
  multi: bool | *false
  includeAll: bool | *false
  allValue?: string
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Group variable kind
GroupByVariableKind: {
  kind: "GroupByVariable"
  spec: GroupByVariableSpec
}

// Adhoc variable specification
AdhocVariableSpec: {
  name: string | *""
  datasource?: DataSourceRef
  baseFilters: [...AdHocFilterWithLabels] | *[]
  filters: [...AdHocFilterWithLabels] | *[]
  defaultKeys: [...MetricFindValue] | *[]
  label?: string
  hide: VariableHide
  skipUrlSync: bool | *false
  description?: string
}

// Define the MetricFindValue type
MetricFindValue: {
  text: string
  value?: string | number
  group?: string
  expandable?: bool
}

// Define the AdHocFilterWithLabels type
AdHocFilterWithLabels: {
  key: string,
  operator: string,
  value: string,
  values?: [...string],
  keyLabel?: string,
  valueLabels?: [...string],
  forceEdit?: bool,
  // @deprecated
  condition?: string,
}

// Adhoc variable kind
AdhocVariableKind: {
  kind: "AdhocVariable"
  spec: AdhocVariableSpec
}

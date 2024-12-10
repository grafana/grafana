// Code generated - EDITING IS FUTILE. DO NOT EDIT.

import * as common from '@grafana/schema';


export interface DashboardV2Spec {
	// Unique numeric identifier for the dashboard.
	// `id` is internal to a specific Grafana instance. `uid` should be used to identify a dashboard across Grafana instances.
	id?: number;
	// Title of dashboard.
	title: string;
	// Description of dashboard.
	description?: string;
	// Configuration of dashboard cursor sync behavior.
	// "Off" for no shared crosshair or tooltip (default).
	// "Crosshair" for shared crosshair.
	// "Tooltip" for shared crosshair AND shared tooltip.
	cursorSync: DashboardCursorSync;
	// When set to true, the dashboard will redraw panels at an interval matching the pixel width.
	// This will keep data "moving left" regardless of the query refresh rate. This setting helps
	// avoid dashboards presenting stale live data.
	liveNow?: boolean;
	// When set to true, the dashboard will load all panels in the dashboard when it's loaded.
	preload: boolean;
	// Whether a dashboard is editable or not.
	editable?: boolean;
	// Links with references to other dashboards or external websites.
	links: DashboardLink[];
	// Tags associated with dashboard.
	tags?: string[];
	timeSettings: TimeSettingsSpec;
	// Configured template variables.
	variables: (QueryVariableKind | TextVariableKind | ConstantVariableKind | DatasourceVariableKind | IntervalVariableKind | CustomVariableKind | GroupByVariableKind | AdhocVariableKind)[];
	// |* more element types in the future
	elements: Record<string, PanelKind>;
	annotations: AnnotationQueryKind[];
	layout: GridLayoutKind;
	// Version of the JSON schema, incremented each time a Grafana update brings
	// changes to said schema.
	// version: will rely on k8s resource versioning, via metadata.resorceVersion
	// revision?: int // for plugins only
	// gnetId?: string // ??? Wat is this used for?
	schemaVersion: number;
}

export const defaultDashboardV2Spec = (): DashboardV2Spec => ({
	title: "",
	cursorSync: "Off",
	preload: false,
	editable: true,
	links: [],
	timeSettings: defaultTimeSettingsSpec(),
	variables: [],
	elements: {},
	annotations: [],
	layout: defaultGridLayoutKind(),
	schemaVersion: 39,
});

export interface AnnotationPanelFilter {
	// Should the specified panels be included or excluded
	exclude?: boolean;
	// Panel IDs that should be included or excluded
	ids: number[];
}

export const defaultAnnotationPanelFilter = (): AnnotationPanelFilter => ({
	exclude: false,
	ids: [],
});

// "Off" for no shared crosshair or tooltip (default).
// "Crosshair" for shared crosshair.
// "Tooltip" for shared crosshair AND shared tooltip.
export type DashboardCursorSync = "Off" | "Crosshair" | "Tooltip";

export const defaultDashboardCursorSync = (): DashboardCursorSync => ("Off");

// Links with references to other dashboards or external resources
export interface DashboardLink {
	// Title to display with the link
	title: string;
	// Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
	// FIXME: The type is generated as `type: DashboardLinkType | dashboardLinkType.Link;` but it should be `type: DashboardLinkType`
	type: DashboardLinkType;
	// Icon name to be displayed with the link
	icon: string;
	// Tooltip to display when the user hovers their mouse over it
	tooltip: string;
	// Link URL. Only required/valid if the type is link
	url?: string;
	// List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards
	tags: string[];
	// If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards
	asDropdown: boolean;
	// If true, the link will be opened in a new tab
	targetBlank: boolean;
	// If true, includes current template variables values in the link as query params
	includeVars: boolean;
	// If true, includes current time range in the link as query params
	keepTime: boolean;
}

export const defaultDashboardLink = (): DashboardLink => ({
	title: "",
	type: "link",
	icon: "",
	tooltip: "",
	tags: [],
	asDropdown: false,
	targetBlank: false,
	includeVars: false,
	keepTime: false,
});

export interface DataSourceRef {
	// The plugin type-id
	type?: string;
	// Specific datasource instance
	uid?: string;
}

export const defaultDataSourceRef = (): DataSourceRef => ({
});

// Transformations allow to manipulate data returned by a query before the system applies a visualization.
// Using transformations you can: rename fields, join time series data, perform mathematical operations across queries,
// use the output of one transformation as the input to another transformation, etc.
export interface DataTransformerConfig {
	// Unique identifier of transformer
	id: string;
	// Disabled transformations are skipped
	disabled?: boolean;
	// Optional frame matcher. When missing it will be applied to all results
	filter?: MatcherConfig;
	// Where to pull DataFrames from as input to transformation
	topic?: common.DataTopic;
	// Options to be passed to the transformer
	// Valid options depend on the transformer id
	options: any;
}

export const defaultDataTransformerConfig = (): DataTransformerConfig => ({
	id: "",
	options: {},
});

export interface DataLink {
	title: string;
	url: string;
	targetBlank?: boolean;
}

export const defaultDataLink = (): DataLink => ({
	title: "",
	url: "",
});

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
export interface FieldConfigSource {
	// Defaults are the options applied to all fields.
	defaults: FieldConfig;
	// Overrides are the options applied to specific fields overriding the defaults.
	overrides: {
		matcher: MatcherConfig;
		properties: DynamicConfigValue[];
	}[];
}

export const defaultFieldConfigSource = (): FieldConfigSource => ({
	defaults: defaultFieldConfig(),
	overrides: [],
});

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
export interface FieldConfig {
	// The display value for this field.  This supports template variables blank is auto
	displayName?: string;
	// This can be used by data sources that return and explicit naming structure for values and labels
	// When this property is configured, this value is used rather than the default naming strategy.
	displayNameFromDS?: string;
	// Human readable field metadata
	description?: string;
	// An explicit path to the field in the datasource.  When the frame meta includes a path,
	// This will default to `${frame.meta.path}/${field.name}
	// 
	// When defined, this value can be used as an identifier within the datasource scope, and
	// may be used to update the results
	path?: string;
	// True if data source can write a value to the path. Auth/authz are supported separately
	writeable?: boolean;
	// True if data source field supports ad-hoc filters
	filterable?: boolean;
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
	unit?: string;
	// Specify the number of decimals Grafana includes in the rendered value.
	// If you leave this field blank, Grafana automatically truncates the number of decimals based on the value.
	// For example 1.1234 will display as 1.12 and 100.456 will display as 100.
	// To display all decimals, set the unit to `String`.
	decimals?: number;
	// The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
	min?: number;
	// The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
	max?: number;
	// Convert input values into a display string
	mappings?: ValueMapping[];
	// Map numeric values to states
	thresholds?: ThresholdsConfig;
	// Panel color configuration
	color?: FieldColor;
	// The behavior when clicking on a result
	links?: any[];
	// Alternative to empty string
	noValue?: string;
	// custom is specified by the FieldConfig field
	// in panel plugin schemas.
	custom?: Record<string, any>;
}

export const defaultFieldConfig = (): FieldConfig => ({
});

export interface DynamicConfigValue {
	id: string;
	value?: any;
}

export const defaultDynamicConfigValue = (): DynamicConfigValue => ({
	id: "",
});

// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
export interface MatcherConfig {
	// The matcher id. This is used to find the matcher implementation from registry.
	id: string;
	// The matcher options. This is specific to the matcher implementation.
	options?: any;
}

export const defaultMatcherConfig = (): MatcherConfig => ({
	id: "",
});

export interface Threshold {
	value: number;
	color: string;
}

export const defaultThreshold = (): Threshold => ({
	value: 0,
	color: "",
});

export type ThresholdsMode = "absolute" | "percentage";

export const defaultThresholdsMode = (): ThresholdsMode => ("absolute");

export interface ThresholdsConfig {
	mode: ThresholdsMode;
	steps: Threshold[];
}

export const defaultThresholdsConfig = (): ThresholdsConfig => ({
	mode: "absolute",
	steps: [],
});

export type ValueMapping = ValueMap | RangeMap | RegexMap | SpecialValueMap;

export const defaultValueMapping = (): ValueMapping => (defaultValueMap());

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
export type MappingType = "value" | "range" | "regex" | "special";

export const defaultMappingType = (): MappingType => ("value");

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
export interface ValueMap {
	type: "value";
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	options: Record<string, ValueMappingResult>;
}

export const defaultValueMap = (): ValueMap => ({
	type: "value",
	options: {},
});

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
export interface RangeMap {
	type: "range";
	// Range to match against and the result to apply when the value is within the range
	options: {
		// Min value of the range. It can be null which means -Infinity
		from: number | null;
		// Max value of the range. It can be null which means +Infinity
		to: number | null;
		// Config to apply when the value is within the range
		result: ValueMappingResult;
	};
}

export const defaultRangeMap = (): RangeMap => ({
	type: "range",
	options: {
	from: 0,
	to: 0,
	result: defaultValueMappingResult(),
},
});

// Maps regular expressions to replacement text and a color.
// For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
export interface RegexMap {
	type: "regex";
	// Regular expression to match against and the result to apply when the value matches the regex
	options: {
		// Regular expression to match against
		pattern: string;
		// Config to apply when the value matches the regex
		result: ValueMappingResult;
	};
}

export const defaultRegexMap = (): RegexMap => ({
	type: "regex",
	options: {
	pattern: "",
	result: defaultValueMappingResult(),
},
});

// Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.
// See SpecialValueMatch to see the list of special values.
// For example, you can configure a special value mapping so that null values appear as N/A.
export interface SpecialValueMap {
	type: "special";
	options: {
		// Special value to match against
		match: SpecialValueMatch;
		// Config to apply when the value matches the special value
		result: ValueMappingResult;
	};
}

export const defaultSpecialValueMap = (): SpecialValueMap => ({
	type: "special",
	options: {
	match: "true",
	result: defaultValueMappingResult(),
},
});

// Special value types supported by the `SpecialValueMap`
export type SpecialValueMatch = "true" | "false" | "null" | "nan" | "null+nan" | "empty";

export const defaultSpecialValueMatch = (): SpecialValueMatch => ("true");

// Result used as replacement with text and color when the value matches
export interface ValueMappingResult {
	// Text to display when the value matches
	text?: string;
	// Text to use when the value matches
	color?: string;
	// Icon to display when the value matches. Only specific visualizations.
	icon?: string;
	// Position in the mapping array. Only used internally.
	index?: number;
}

export const defaultValueMappingResult = (): ValueMappingResult => ({
});

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
export type FieldColorModeId = "thresholds" | "palette-classic" | "palette-classic-by-name" | "continuous-GrYlRd" | "continuous-RdYlGr" | "continuous-BlYlRd" | "continuous-YlRd" | "continuous-BlPu" | "continuous-YlBl" | "continuous-blues" | "continuous-reds" | "continuous-greens" | "continuous-purples" | "fixed" | "shades";

export const defaultFieldColorModeId = (): FieldColorModeId => ("thresholds");

// Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
export type FieldColorSeriesByMode = "min" | "max" | "last";

export const defaultFieldColorSeriesByMode = (): FieldColorSeriesByMode => ("min");

// Map a field to a color.
export interface FieldColor {
	// The main color scheme mode.
	mode: FieldColorModeId;
	// The fixed color value for fixed or shades color modes.
	fixedColor?: string;
	// Some visualizations need to know how to assign a series color from by value color schemes.
	seriesBy?: FieldColorSeriesByMode;
}

export const defaultFieldColor = (): FieldColor => ({
	mode: "thresholds",
});

// Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
export type DashboardLinkType = "link" | "dashboards";

export const defaultDashboardLinkType = (): DashboardLinkType => ("link");

// --- Common types ---
export interface Kind {
	kind: string;
	spec: any;
	metadata?: any;
}

export const defaultKind = (): Kind => ({
	kind: "",
	spec: {},
});

// --- Kinds ---
export interface VizConfigSpec {
	pluginVersion: string;
	options: Record<string, any>;
	fieldConfig: FieldConfigSource;
}

export const defaultVizConfigSpec = (): VizConfigSpec => ({
	pluginVersion: "",
	options: {},
	fieldConfig: defaultFieldConfigSource(),
});

export interface VizConfigKind {
	// The kind of a VizConfigKind is the plugin ID
	kind: string;
	spec: VizConfigSpec;
}

export const defaultVizConfigKind = (): VizConfigKind => ({
	kind: "",
	spec: defaultVizConfigSpec(),
});

export interface AnnotationQuerySpec {
	datasource?: DataSourceRef;
	query: DataQueryKind;
	builtIn?: boolean;
	enable: boolean;
	filter: AnnotationPanelFilter;
	hide: boolean;
	iconColor: string;
	name: string;
}

export const defaultAnnotationQuerySpec = (): AnnotationQuerySpec => ({
	query: defaultDataQueryKind(),
	enable: false,
	filter: defaultAnnotationPanelFilter(),
	hide: false,
	iconColor: "",
	name: "",
});

export interface AnnotationQueryKind {
	kind: "AnnotationQuery";
	spec: AnnotationQuerySpec;
}

export const defaultAnnotationQueryKind = (): AnnotationQueryKind => ({
	kind: "AnnotationQuery",
	spec: defaultAnnotationQuerySpec(),
});

export interface QueryOptionsSpec {
	timeFrom?: string;
	maxDataPoints?: number;
	timeShift?: string;
	queryCachingTTL?: number;
	interval?: string;
	cacheTimeout?: string;
	hideTimeOverride?: boolean;
}

export const defaultQueryOptionsSpec = (): QueryOptionsSpec => ({
});

export interface DataQueryKind {
	// The kind of a DataQueryKind is the datasource type
	kind: string;
	spec: Record<string, any>;
}

export const defaultDataQueryKind = (): DataQueryKind => ({
	kind: "",
	spec: {},
});

export interface PanelQuerySpec {
	query: DataQueryKind;
	datasource?: DataSourceRef;
	refId: string;
	hidden: boolean;
}

export const defaultPanelQuerySpec = (): PanelQuerySpec => ({
	query: defaultDataQueryKind(),
	refId: "",
	hidden: false,
});

export interface PanelQueryKind {
	kind: "PanelQuery";
	spec: PanelQuerySpec;
}

export const defaultPanelQueryKind = (): PanelQueryKind => ({
	kind: "PanelQuery",
	spec: defaultPanelQuerySpec(),
});

export interface TransformationKind {
	// The kind of a TransformationKind is the transformation ID
	kind: string;
	spec: DataTransformerConfig;
}

export const defaultTransformationKind = (): TransformationKind => ({
	kind: "",
	spec: defaultDataTransformerConfig(),
});

export interface QueryGroupSpec {
	queries: PanelQueryKind[];
	transformations: TransformationKind[];
	queryOptions: QueryOptionsSpec;
}

export const defaultQueryGroupSpec = (): QueryGroupSpec => ({
	queries: [],
	transformations: [],
	queryOptions: defaultQueryOptionsSpec(),
});

export interface QueryGroupKind {
	kind: "QueryGroup";
	spec: QueryGroupSpec;
}

export const defaultQueryGroupKind = (): QueryGroupKind => ({
	kind: "QueryGroup",
	spec: defaultQueryGroupSpec(),
});

// Time configuration
// It defines the default time config for the time picker, the refresh picker for the specific dashboard.
export interface TimeSettingsSpec {
	// Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc".
	timezone?: string;
	// Start time range for dashboard.
	// Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
	from: string;
	// End time range for dashboard.
	// Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
	to: string;
	// Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".
	// v1: refresh
	autoRefresh: string;
	// Interval options available in the refresh picker dropdown.
	// v1: timepicker.refresh_intervals
	autoRefreshIntervals: string[];
	// Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.
	// v1: timepicker.time_options , not exposed in the UI
	quickRanges: string[];
	// Whether timepicker is visible or not.
	// v1: timepicker.hidden
	hideTimepicker: boolean;
	// Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
	weekStart: string;
	// The month that the fiscal year starts on. 0 = January, 11 = December
	fiscalYearStartMonth: number;
	// Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
	// v1: timepicker.nowDelay
	nowDelay?: string;
}

export const defaultTimeSettingsSpec = (): TimeSettingsSpec => ({
	timezone: "browser",
	from: "now-6h",
	to: "now",
	autoRefresh: "",
	autoRefreshIntervals: [
"5s",
"10s",
"30s",
"1m",
"5m",
"15m",
"30m",
"1h",
"2h",
"1d",
],
	quickRanges: [
"5m",
"15m",
"1h",
"6h",
"12h",
"24h",
"2d",
"7d",
"30d",
],
	hideTimepicker: false,
	weekStart: "",
	fiscalYearStartMonth: 0,
});

export interface GridLayoutItemSpec {
	x: number;
	y: number;
	width: number;
	height: number;
	// reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
	element: ElementReference;
}

export const defaultGridLayoutItemSpec = (): GridLayoutItemSpec => ({
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	element: defaultElementReference(),
});

export interface GridLayoutItemKind {
	kind: "GridLayoutItem";
	spec: GridLayoutItemSpec;
}

export const defaultGridLayoutItemKind = (): GridLayoutItemKind => ({
	kind: "GridLayoutItem",
	spec: defaultGridLayoutItemSpec(),
});

export interface GridLayoutSpec {
	items: GridLayoutItemKind[];
}

export const defaultGridLayoutSpec = (): GridLayoutSpec => ({
	items: [],
});

export interface GridLayoutKind {
	kind: "GridLayout";
	spec: GridLayoutSpec;
}

export const defaultGridLayoutKind = (): GridLayoutKind => ({
	kind: "GridLayout",
	spec: defaultGridLayoutSpec(),
});

export interface PanelSpec {
	uid: string;
	title: string;
	description: string;
	links: DataLink[];
	data: QueryGroupKind;
	vizConfig: VizConfigKind;
}

export const defaultPanelSpec = (): PanelSpec => ({
	uid: "",
	title: "",
	description: "",
	links: [],
	data: defaultQueryGroupKind(),
	vizConfig: defaultVizConfigKind(),
});

export interface PanelKind {
	kind: "Panel";
	spec: PanelSpec;
}

export const defaultPanelKind = (): PanelKind => ({
	kind: "Panel",
	spec: defaultPanelSpec(),
});

export interface ElementReference {
	kind: "ElementReference";
	name: string;
}

export const defaultElementReference = (): ElementReference => ({
	kind: "ElementReference",
	name: "",
});

// Variable types
export type VariableValue = VariableValueSingle | VariableValueSingle[];

export const defaultVariableValue = (): VariableValue => (defaultVariableValueSingle());

export type VariableValueSingle = string | boolean | number | CustomVariableValue;

export const defaultVariableValueSingle = (): VariableValueSingle => ("");

// Custom formatter variable
export interface CustomFormatterVariable {
	name: string;
	type: VariableType;
	multi: boolean;
	includeAll: boolean;
}

export const defaultCustomFormatterVariable = (): CustomFormatterVariable => ({
	name: "",
	type: "query",
	multi: false,
	includeAll: false,
});

// Custom variable value
export interface CustomVariableValue {
	// The format name or function used in the expression
	formatter: string | VariableCustomFormatterFn;
}

export const defaultCustomVariableValue = (): CustomVariableValue => ({
	formatter: "",
});

// Custom formatter function
export interface VariableCustomFormatterFn {
	value: any;
	legacyVariableModel: {
		name: string;
		type: VariableType;
		multi: boolean;
		includeAll: boolean;
	};
	legacyDefaultFormatter?: VariableCustomFormatterFn;
}

export const defaultVariableCustomFormatterFn = (): VariableCustomFormatterFn => ({
	value: {},
	legacyVariableModel: {
	name: "",
	type: "query",
	multi: false,
	includeAll: false,
},
});

// Dashboard variable type
// `query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.
// `adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).
// `constant`: 	Define a hidden constant.
// `datasource`: Quickly change the data source for an entire dashboard.
// `interval`: Interval variables represent time spans.
// `textbox`: Display a free text input field with an optional default value.
// `custom`: Define the variable options manually using a comma-separated list.
// `system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
export type VariableType = "query" | "adhoc" | "groupby" | "constant" | "datasource" | "interval" | "textbox" | "custom" | "system" | "snapshot";

export const defaultVariableType = (): VariableType => ("query");

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
export type VariableSort = "disabled" | "alphabeticalAsc" | "alphabeticalDesc" | "numericalAsc" | "numericalDesc" | "alphabeticalCaseInsensitiveAsc" | "alphabeticalCaseInsensitiveDesc" | "naturalAsc" | "naturalDesc";

export const defaultVariableSort = (): VariableSort => ("disabled");

// Options to config when to refresh a variable
// `never`: Never refresh the variable
// `onDashboardLoad`: Queries the data source every time the dashboard loads.
// `onTimeRangeChanged`: Queries the data source when the dashboard time range changes.
export type VariableRefresh = "never" | "onDashboardLoad" | "onTimeRangeChanged";

export const defaultVariableRefresh = (): VariableRefresh => ("never");

// Determine if the variable shows on dashboard
// Accepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing).
export type VariableHide = "dontHide" | "hideLabel" | "hideVariable";

export const defaultVariableHide = (): VariableHide => ("dontHide");

// FIXME: should we introduce this? --- Variable value option
export interface VariableValueOption {
	label: string;
	value: VariableValueSingle;
	group?: string;
}

export const defaultVariableValueOption = (): VariableValueOption => ({
	label: "",
	value: defaultVariableValueSingle(),
});

// Variable option specification
export interface VariableOption {
	// Whether the option is selected or not
	selected?: boolean;
	// Text to be displayed for the option
	text: string | string[];
	// Value of the option
	value: string | string[];
}

export const defaultVariableOption = (): VariableOption => ({
	text: "",
	value: "",
});

// Query variable specification
export interface QueryVariableSpec {
	name: string;
	current: VariableOption;
	label?: string;
	hide: VariableHide;
	refresh: VariableRefresh;
	skipUrlSync: boolean;
	description?: string;
	datasource?: DataSourceRef;
	query: string | DataQueryKind;
	regex: string;
	sort: VariableSort;
	definition?: string;
	options: VariableOption[];
	multi: boolean;
	includeAll: boolean;
	allValue?: string;
	placeholder?: string;
}

export const defaultQueryVariableSpec = (): QueryVariableSpec => ({
	name: "",
	current: { text: "", value: "", },
	hide: "dontHide",
	refresh: "never",
	skipUrlSync: false,
	query: "",
	regex: "",
	sort: "disabled",
	options: [],
	multi: false,
	includeAll: false,
});

// Query variable kind
export interface QueryVariableKind {
	kind: "QueryVariable";
	spec: QueryVariableSpec;
}

export const defaultQueryVariableKind = (): QueryVariableKind => ({
	kind: "QueryVariable",
	spec: defaultQueryVariableSpec(),
});

// Text variable specification
export interface TextVariableSpec {
	name: string;
	current: VariableOption;
	query: string;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultTextVariableSpec = (): TextVariableSpec => ({
	name: "",
	current: { text: "", value: "", },
	query: "",
	hide: "dontHide",
	skipUrlSync: false,
});

// Text variable kind
export interface TextVariableKind {
	kind: "TextVariable";
	spec: TextVariableSpec;
}

export const defaultTextVariableKind = (): TextVariableKind => ({
	kind: "TextVariable",
	spec: defaultTextVariableSpec(),
});

// Constant variable specification
export interface ConstantVariableSpec {
	name: string;
	query: string;
	current: VariableOption;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultConstantVariableSpec = (): ConstantVariableSpec => ({
	name: "",
	query: "",
	current: { text: "", value: "", },
	hide: "dontHide",
	skipUrlSync: false,
});

// Constant variable kind
export interface ConstantVariableKind {
	kind: "ConstantVariable";
	spec: ConstantVariableSpec;
}

export const defaultConstantVariableKind = (): ConstantVariableKind => ({
	kind: "ConstantVariable",
	spec: defaultConstantVariableSpec(),
});

// Datasource variable specification
export interface DatasourceVariableSpec {
	name: string;
	pluginId: string;
	refresh: VariableRefresh;
	regex: string;
	current: VariableOption;
	defaultOptionEnabled: boolean;
	options: VariableOption[];
	multi: boolean;
	includeAll: boolean;
	allValue?: string;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultDatasourceVariableSpec = (): DatasourceVariableSpec => ({
	name: "",
	pluginId: "",
	refresh: "never",
	regex: "",
	current: { text: "", value: "", },
	defaultOptionEnabled: false,
	options: [],
	multi: false,
	includeAll: false,
	hide: "dontHide",
	skipUrlSync: false,
});

// Datasource variable kind
export interface DatasourceVariableKind {
	kind: "DatasourceVariable";
	spec: DatasourceVariableSpec;
}

export const defaultDatasourceVariableKind = (): DatasourceVariableKind => ({
	kind: "DatasourceVariable",
	spec: defaultDatasourceVariableSpec(),
});

// Interval variable specification
export interface IntervalVariableSpec {
	name: string;
	query: string;
	current: VariableOption;
	options: VariableOption[];
	auto: boolean;
	auto_min: string;
	auto_count: number;
	refresh: VariableRefresh;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultIntervalVariableSpec = (): IntervalVariableSpec => ({
	name: "",
	query: "",
	current: { text: "", value: "", },
	options: [],
	auto: false,
	auto_min: "",
	auto_count: 0,
	refresh: "never",
	hide: "dontHide",
	skipUrlSync: false,
});

// Interval variable kind
export interface IntervalVariableKind {
	kind: "IntervalVariable";
	spec: IntervalVariableSpec;
}

export const defaultIntervalVariableKind = (): IntervalVariableKind => ({
	kind: "IntervalVariable",
	spec: defaultIntervalVariableSpec(),
});

// Custom variable specification
export interface CustomVariableSpec {
	name: string;
	query: string;
	current: VariableOption;
	options: VariableOption[];
	multi: boolean;
	includeAll: boolean;
	allValue?: string;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultCustomVariableSpec = (): CustomVariableSpec => ({
	name: "",
	query: "",
	current: defaultVariableOption(),
	options: [],
	multi: false,
	includeAll: false,
	hide: "dontHide",
	skipUrlSync: false,
});

// Custom variable kind
export interface CustomVariableKind {
	kind: "CustomVariable";
	spec: CustomVariableSpec;
}

export const defaultCustomVariableKind = (): CustomVariableKind => ({
	kind: "CustomVariable",
	spec: defaultCustomVariableSpec(),
});

// GroupBy variable specification
export interface GroupByVariableSpec {
	name: string;
	datasource?: DataSourceRef;
	current: VariableOption;
	options: VariableOption[];
	multi: boolean;
	includeAll: boolean;
	allValue?: string;
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultGroupByVariableSpec = (): GroupByVariableSpec => ({
	name: "",
	current: { text: "", value: "", },
	options: [],
	multi: false,
	includeAll: false,
	hide: "dontHide",
	skipUrlSync: false,
});

// Group variable kind
export interface GroupByVariableKind {
	kind: "GroupByVariable";
	spec: GroupByVariableSpec;
}

export const defaultGroupByVariableKind = (): GroupByVariableKind => ({
	kind: "GroupByVariable",
	spec: defaultGroupByVariableSpec(),
});

// Adhoc variable specification
export interface AdhocVariableSpec {
	name: string;
	datasource?: DataSourceRef;
	baseFilters: AdHocFilterWithLabels[];
	filters: AdHocFilterWithLabels[];
	defaultKeys: MetricFindValue[];
	label?: string;
	hide: VariableHide;
	skipUrlSync: boolean;
	description?: string;
}

export const defaultAdhocVariableSpec = (): AdhocVariableSpec => ({
	name: "",
	baseFilters: [],
	filters: [],
	defaultKeys: [],
	hide: "dontHide",
	skipUrlSync: false,
});

// Define the MetricFindValue type
export interface MetricFindValue {
	text: string;
	value?: string | number;
	group?: string;
	expandable?: boolean;
}

export const defaultMetricFindValue = (): MetricFindValue => ({
	text: "",
});

// Define the AdHocFilterWithLabels type
export interface AdHocFilterWithLabels {
	key: string;
	operator: string;
	value: string;
	values?: string[];
	keyLabel?: string;
	valueLabels?: string[];
	forceEdit?: boolean;
	// @deprecated
	condition?: string;
}

export const defaultAdHocFilterWithLabels = (): AdHocFilterWithLabels => ({
	key: "",
	operator: "",
	value: "",
});

// Adhoc variable kind
export interface AdhocVariableKind {
	kind: "AdhocVariable";
	spec: AdhocVariableSpec;
}

export const defaultAdhocVariableKind = (): AdhocVariableKind => ({
	kind: "AdhocVariable",
	spec: defaultAdhocVariableSpec(),
});


// Code generated - EDITING IS FUTILE. DO NOT EDIT.

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
	// v1: timepicker.quick_ranges , not exposed in the UI
	quickRanges?: TimeRangeOption[];
	// Whether timepicker is visible or not.
	// v1: timepicker.hidden
	hideTimepicker: boolean;
	// Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
	weekStart?: "saturday" | "monday" | "sunday";
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
	hideTimepicker: false,
	fiscalYearStartMonth: 0,
});

export interface TimeRangeOption {
	display: string;
	from: string;
	to: string;
}

export const defaultTimeRangeOption = (): TimeRangeOption => ({
	display: "Last 6 hours",
	from: "now-6h",
	to: "now",
});

// A notebook element is a narrative cell, a panel, or a library panel. Unlike the dashboard
// Element union, this one includes CellKind — and it is referenced ONLY by NotebookSpec.
// CellKind is listed first so it is the generated default (a notebook is narrative-first).
export type NotebookElement = CellKind | PanelKind | LibraryPanelKind;

export const defaultNotebookElement = (): NotebookElement => (defaultCellKind());

// A cell holds non-panel narrative content (markdown text, code) in a notebook layout.
// Panel cells are not represented here — they reuse PanelKind.
export interface CellKind {
	kind: "Cell";
	spec: CellSpec;
}

export const defaultCellKind = (): CellKind => ({
	kind: "Cell",
	spec: defaultCellSpec(),
});

export interface CellSpec {
	content: CellContentKind;
}

export const defaultCellSpec = (): CellSpec => ({
	content: defaultCellContentKind(),
});

// Pluggable cell content discriminated by `kind`. New content types are added
// by extending this union with another <Name>CellContentKind member.
export type CellContentKind = MarkdownCellContentKind | CodeCellContentKind;

export const defaultCellContentKind = (): CellContentKind => (defaultMarkdownCellContentKind());

export interface MarkdownCellContentKind {
	kind: "Markdown";
	spec: MarkdownCellContentSpec;
}

export const defaultMarkdownCellContentKind = (): MarkdownCellContentKind => ({
	kind: "Markdown",
	spec: defaultMarkdownCellContentSpec(),
});

export interface MarkdownCellContentSpec {
	text: string;
}

export const defaultMarkdownCellContentSpec = (): MarkdownCellContentSpec => ({
	text: "",
});

export interface CodeCellContentKind {
	kind: "Code";
	spec: CodeCellContentSpec;
}

export const defaultCodeCellContentKind = (): CodeCellContentKind => ({
	kind: "Code",
	spec: defaultCodeCellContentSpec(),
});

export interface CodeCellContentSpec {
	language: string;
	code: string;
	highlight?: number[];
	annotation?: string;
}

export const defaultCodeCellContentSpec = (): CodeCellContentSpec => ({
	language: "",
	code: "",
});

export interface PanelKind {
	kind: "Panel";
	spec: PanelSpec;
}

export const defaultPanelKind = (): PanelKind => ({
	kind: "Panel",
	spec: defaultPanelSpec(),
});

export interface PanelSpec {
	id: number;
	title: string;
	description: string;
	links: DataLink[];
	data: QueryGroupKind;
	vizConfig: VizConfigKind;
	transparent?: boolean;
}

export const defaultPanelSpec = (): PanelSpec => ({
	id: 0,
	title: "",
	description: "",
	links: [],
	data: defaultQueryGroupKind(),
	vizConfig: defaultVizConfigKind(),
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

export interface QueryGroupKind {
	kind: "QueryGroup";
	spec: QueryGroupSpec;
}

export const defaultQueryGroupKind = (): QueryGroupKind => ({
	kind: "QueryGroup",
	spec: defaultQueryGroupSpec(),
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

export interface PanelQueryKind {
	kind: "PanelQuery";
	spec: PanelQuerySpec;
}

export const defaultPanelQueryKind = (): PanelQueryKind => ({
	kind: "PanelQuery",
	spec: defaultPanelQuerySpec(),
});

export interface PanelQuerySpec {
	query: DataQueryKind;
	refId: string;
	hidden: boolean;
}

export const defaultPanelQuerySpec = (): PanelQuerySpec => ({
	query: defaultDataQueryKind(),
	refId: "A",
	hidden: false,
});

export interface DataQueryKind {
	kind: "DataQuery";
	group: string;
	version: string;
	labels?: Record<string, string>;
	// New type for datasource reference
	// Not creating a new type until we figure out how to handle DS refs for group by, adhoc, and every place that uses DataSourceRef in TS.
	datasource?: {
		name?: string;
	};
	spec: Record<string, any>;
}

export const defaultDataQueryKind = (): DataQueryKind => ({
	kind: "DataQuery",
	group: "",
	version: "v0",
	spec: {},
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
	topic?: DataTopic;
	// Options to be passed to the transformer
	// Valid options depend on the transformer id
	options: any;
}

export const defaultDataTransformerConfig = (): DataTransformerConfig => ({
	id: "",
	options: {},
});

// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
export interface MatcherConfig {
	// The matcher id. This is used to find the matcher implementation from registry.
	id: string;
	// If set, limits this matcher to fields of that type. If not set, "series" mode is used.
	scope?: MatcherScope;
	// The matcher options. This is specific to the matcher implementation.
	options?: any;
}

export const defaultMatcherConfig = (): MatcherConfig => ({
	id: "",
});

export type MatcherScope = "series" | "nested" | "annotation" | "exemplar";

export const defaultMatcherScope = (): MatcherScope => ("series");

// A topic is attached to DataFrame metadata in query results.
// This specifies where the data should be used.
export type DataTopic = "series" | "annotations" | "alertStates";

export const defaultDataTopic = (): DataTopic => ("series");

export interface QueryOptionsSpec {
	timeFrom?: string;
	maxDataPoints?: number;
	timeShift?: string;
	queryCachingTTL?: number;
	interval?: string;
	cacheTimeout?: string;
	hideTimeOverride?: boolean;
	timeCompare?: string;
}

export const defaultQueryOptionsSpec = (): QueryOptionsSpec => ({
});

export interface VizConfigKind {
	kind: "VizConfig";
	// The group is the plugin ID
	group: string;
	version: string;
	spec: VizConfigSpec;
}

export const defaultVizConfigKind = (): VizConfigKind => ({
	kind: "VizConfig",
	group: "",
	version: "",
	spec: defaultVizConfigSpec(),
});

// --- Kinds ---
export interface VizConfigSpec {
	options: Record<string, any>;
	fieldConfig: FieldConfigSource;
}

export const defaultVizConfigSpec = (): VizConfigSpec => ({
	options: {},
	fieldConfig: defaultFieldConfigSource(),
});

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
export interface FieldConfigSource {
	// Defaults are the options applied to all fields.
	defaults: FieldConfig;
	// Overrides are the options applied to specific fields overriding the defaults.
	overrides: {
		// Describes config override rules created when interacting with Grafana.
		__systemRef?: string;
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
	// You can use the units ID available in Grafana or a custom unit.
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
	// Define interactive HTTP requests that can be triggered from data visualizations.
	actions?: Action[];
	// Alternative to empty string
	noValue?: string;
	// custom is specified by the FieldConfig field
	// in panel plugin schemas.
	custom?: Record<string, any>;
	// Calculate min max per field
	fieldMinMax?: boolean;
	// How null values should be handled when calculating field stats
	// "null" - Include null values, "connected" - Ignore nulls, "null as zero" - Treat nulls as zero
	nullValueMode?: NullValueMode;
}

export const defaultFieldConfig = (): FieldConfig => ({
});

export type ValueMapping = ValueMap | RangeMap | RegexMap | SpecialValueMap;

export const defaultValueMapping = (): ValueMapping => (defaultValueMap());

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

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
export type MappingType = "value" | "range" | "regex" | "special";

export const defaultMappingType = (): MappingType => ("value");

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

export interface ThresholdsConfig {
	mode: ThresholdsMode;
	steps: Threshold[];
}

export const defaultThresholdsConfig = (): ThresholdsConfig => ({
	mode: "absolute",
	steps: [],
});

export type ThresholdsMode = "absolute" | "percentage";

export const defaultThresholdsMode = (): ThresholdsMode => ("absolute");

export interface Threshold {
	// Value null means -Infinity
	value: number | null;
	color: string;
}

export const defaultThreshold = (): Threshold => ({
	value: 0,
	color: "",
});

// Map a field to a color.
export interface FieldColor {
	// The main color scheme mode.
	mode: FieldColorModeId;
	// The fixed color value for fixed or shades color modes.
	fixedColor?: string;
	// The end color for the gradient color mode (smallest value). Only used when mode is gradient.
	gradientColorTo?: string;
	// Some visualizations need to know how to assign a series color from by value color schemes.
	seriesBy?: FieldColorSeriesByMode;
}

export const defaultFieldColor = (): FieldColor => ({
	mode: "thresholds",
});

// Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
// Continuous color interpolates a color using the percentage of a value relative to min and max.
// Accepted values are:
// `thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold
// `palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations
// `palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations
// `palette-colorblind`: Color blind safe palette. A discrete palette whose colors are distinguishable under common forms of color vision deficiency. Useful for categorical and multi-series data visualizations
// `palette-categorical-next`: Experimental categorical palette. Useful for categorical and multi-series data visualizations
// `palette-categorical-next-2`: Experimental categorical palette. Useful for categorical and multi-series data visualizations
// `palette-categorical-next-3`: Experimental categorical palette. Useful for categorical and multi-series data visualizations
// `continuous-viridis`: Continuous Viridis palette mode
// `continuous-magma`: Continuous Magma palette mode
// `continuous-plasma`: Continuous Plasma palette mode
// `continuous-inferno`: Continuous Inferno palette mode
// `continuous-cividis`: Continuous Cividis palette mode
// `continuous-GrYlRd`: Continuous Green-Yellow-Red palette mode
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
// `gradient`: Gradient color mode. Interpolate between two colors based on value order; the start color is taken from fixedColor and the end color from gradientColorTo.
export type FieldColorModeId = "thresholds" | "palette-classic" | "palette-classic-by-name" | "palette-colorblind" | "palette-categorical-next" | "palette-categorical-next-2" | "palette-categorical-next-3" | "continuous-viridis" | "continuous-magma" | "continuous-plasma" | "continuous-inferno" | "continuous-cividis" | "continuous-GrYlRd" | "continuous-RdYlGr" | "continuous-BlYlRd" | "continuous-YlRd" | "continuous-BlPu" | "continuous-YlBl" | "continuous-blues" | "continuous-reds" | "continuous-greens" | "continuous-purples" | "fixed" | "shades" | "gradient";

export const defaultFieldColorModeId = (): FieldColorModeId => ("thresholds");

// Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
export type FieldColorSeriesByMode = "min" | "max" | "last";

export const defaultFieldColorSeriesByMode = (): FieldColorSeriesByMode => ("min");

export interface Action {
	type: ActionType;
	title: string;
	fetch?: FetchOptions;
	infinity?: InfinityOptions;
	confirmation?: string;
	oneClick?: boolean;
	variables?: ActionVariable[];
	style?: {
		backgroundColor?: string;
	};
}

export const defaultAction = (): Action => ({
	type: "fetch",
	title: "",
});

export type ActionType = "fetch" | "infinity";

export const defaultActionType = (): ActionType => ("fetch");

export interface FetchOptions {
	method: HttpRequestMethod;
	url: string;
	body?: string;
	// These are 2D arrays of strings, each representing a key-value pair
	// We are defining them this way because we can't generate a go struct that
	// that would have exactly two strings in each sub-array
	queryParams?: string[][];
	headers?: string[][];
}

export const defaultFetchOptions = (): FetchOptions => ({
	method: "GET",
	url: "",
});

export type HttpRequestMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH";

export const defaultHttpRequestMethod = (): HttpRequestMethod => ("GET");

export interface InfinityOptions {
	method: HttpRequestMethod;
	url: string;
	body?: string;
	// These are 2D arrays of strings, each representing a key-value pair
	// We are defining them this way because we can't generate a go struct that
	// that would have exactly two strings in each sub-array
	queryParams?: string[][];
	datasourceUid: string;
	headers?: string[][];
}

export const defaultInfinityOptions = (): InfinityOptions => ({
	method: "GET",
	url: "",
	datasourceUid: "",
});

export interface ActionVariable {
	key: string;
	name: string;
	type: "string";
}

export const defaultActionVariable = (): ActionVariable => ({
	key: "",
	name: "",
	type: ActionVariableType,
});

// Action variable type
export const ActionVariableType = "string";

// How null values should be handled
export type NullValueMode = "null" | "connected" | "null as zero";

export const defaultNullValueMode = (): NullValueMode => ("null");

export interface DynamicConfigValue {
	id: string;
	value?: any;
}

export const defaultDynamicConfigValue = (): DynamicConfigValue => ({
	id: "",
});

export interface LibraryPanelKind {
	kind: "LibraryPanel";
	spec: LibraryPanelKindSpec;
}

export const defaultLibraryPanelKind = (): LibraryPanelKind => ({
	kind: "LibraryPanel",
	spec: defaultLibraryPanelKindSpec(),
});

export interface LibraryPanelKindSpec {
	// Panel ID for the library panel in the dashboard
	id: number;
	// Title for the library panel in the dashboard
	title: string;
	libraryPanel: LibraryPanelRef;
}

export const defaultLibraryPanelKindSpec = (): LibraryPanelKindSpec => ({
	id: 0,
	title: "",
	libraryPanel: defaultLibraryPanelRef(),
});

// A library panel is a reusable panel that you can use in any dashboard.
// When you make a change to a library panel, that change propagates to all instances of where the panel is used.
// Library panels streamline reuse of panels across multiple dashboards.
export interface LibraryPanelRef {
	// Library panel name
	name: string;
	// Library panel uid
	uid: string;
}

export const defaultLibraryPanelRef = (): LibraryPanelRef => ({
	name: "",
	uid: "",
});

export interface NotebookLayoutKind {
	kind: "NotebookLayout";
	spec: NotebookLayoutSpec;
}

export const defaultNotebookLayoutKind = (): NotebookLayoutKind => ({
	kind: "NotebookLayout",
	spec: defaultNotebookLayoutSpec(),
});

export interface NotebookLayoutSpec {
	cells: NotebookLayoutItemKind[];
}

export const defaultNotebookLayoutSpec = (): NotebookLayoutSpec => ({
	cells: [],
});

export interface NotebookLayoutItemKind {
	kind: "NotebookLayoutItem";
	spec: NotebookLayoutItemSpec;
}

export const defaultNotebookLayoutItemKind = (): NotebookLayoutItemKind => ({
	kind: "NotebookLayoutItem",
	spec: defaultNotebookLayoutItemSpec(),
});

// One ordered item in a notebook layout. `element` references either a CellKind
// (markdown/code content) or a PanelKind in the notebook's elements map. `source`
// records who authored the cell; `collapsed` hides the body in the UI.
export interface NotebookLayoutItemSpec {
	element: ElementReference;
	source: "assistant" | "user";
	collapsed?: boolean;
}

export const defaultNotebookLayoutItemSpec = (): NotebookLayoutItemSpec => ({
	element: defaultElementReference(),
	source: "assistant",
});

export interface ElementReference {
	kind: "ElementReference";
	name: string;
}

export const defaultElementReference = (): ElementReference => ({
	kind: "ElementReference",
	name: "",
});

export interface Spec {
	title: string;
	description?: string;
	tags: string[];
	timeSettings: TimeSettingsSpec;
	elements: Record<string, NotebookElement>;
	layout: NotebookLayoutKind;
}

export const defaultSpec = (): Spec => ({
	title: "",
	tags: [],
	timeSettings: defaultTimeSettingsSpec(),
	elements: {},
	layout: defaultNotebookLayoutKind(),
});


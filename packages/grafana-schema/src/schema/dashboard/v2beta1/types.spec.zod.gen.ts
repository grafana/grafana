// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// @ts-nocheck
import { z } from 'zod';

export const DashboardSpecSchema = z.object({
	annotations: z.array(z.lazy(() => AnnotationQueryKindSchema)),
	cursorSync: z.lazy(() => DashboardCursorSyncSchema).optional().default("Off").describe("Configuration of dashboard cursor sync behavior.\n\"Off\" for no shared crosshair or tooltip (default).\n\"Crosshair\" for shared crosshair.\n\"Tooltip\" for shared crosshair AND shared tooltip."),
	description: z.string().optional().describe("Description of dashboard."),
	editable: z.boolean().optional().default(true).describe("Whether a dashboard is editable or not."),
	elements: z.record(z.string(), z.lazy(() => ElementSchema)),
	layout: z.discriminatedUnion("kind", [z.lazy(() => GridLayoutKindSchema), z.lazy(() => RowsLayoutKindSchema), z.lazy(() => AutoGridLayoutKindSchema), z.lazy(() => TabsLayoutKindSchema)]),
	links: z.array(z.lazy(() => DashboardLinkSchema)).describe("Links with references to other dashboards or external websites."),
	liveNow: z.boolean().optional().describe("When set to true, the dashboard will redraw panels at an interval matching the pixel width.\nThis will keep data \"moving left\" regardless of the query refresh rate. This setting helps\navoid dashboards presenting stale live data."),
	preload: z.boolean().optional().default(false).describe("When set to true, the dashboard will load all panels in the dashboard when it's loaded."),
	revision: z.number().int().optional().describe("Plugins only. The version of the dashboard installed together with the plugin.\nThis is used to determine if the dashboard should be updated when the plugin is updated."),
	tags: z.array(z.string()).describe("Tags associated with dashboard."),
	timeSettings: z.lazy(() => TimeSettingsSpecSchema),
	title: z.string().describe("Title of dashboard."),
	variables: z.array(z.lazy(() => VariableKindSchema)).describe("Configured template variables."),
});

export const AnnotationQueryKindSchema = z.object({
	kind: z.literal("AnnotationQuery").optional().default("AnnotationQuery"),
	spec: z.lazy(() => AnnotationQuerySpecSchema),
}).describe("Dashboard annotation layer (a query that produces event markers shown on time-series panels).");

export const AnnotationQuerySpecSchema = z.object({
	query: z.lazy(() => DataQueryKindSchema).describe("Annotation query. For built-in dashboard annotations use group: \"grafana\"."),
	enable: z.boolean().optional().default(true).describe("Whether the annotation is enabled by default"),
	hide: z.boolean().optional().default(false).describe("Whether the annotation toggle is hidden from the dashboard controls"),
	iconColor: z.string().optional().default("red").describe("Icon color for the annotation marker (e.g., \"red\", \"blue\", semantic color name)"),
	name: z.string().describe("Annotation name. Must be unique within the dashboard."),
	builtIn: z.boolean().optional().default(false).describe("Built-in Grafana dashboard annotations layer. Exactly one built-in annotation exists per dashboard and is managed by Grafana."),
	filter: z.lazy(() => AnnotationPanelFilterSchema).optional().describe("Limit the annotation to specific panels"),
	placement: z.literal("inControlsMenu").optional().describe("Render the annotation toggle in the dashboard controls dropdown menu instead of inline."),
	mappings: z.record(z.string(), z.lazy(() => AnnotationEventFieldMappingSchema)).optional().describe("Mappings define how to convert data frame fields to annotation event fields."),
	legacyOptions: z.record(z.string(), z.unknown()).optional().describe("Catch-all field for datasource-specific properties. Should not be available in as code tooling."),
});

export const DataQueryKindSchema = z.object({
	kind: z.literal("DataQuery").optional().default("DataQuery"),
	group: z.string().describe("Datasource type (e.g., \"prometheus\", \"loki\", \"mysql\")"),
	version: z.string().optional().default("v0"),
	labels: z.record(z.string(), z.string()).optional(),
	datasource: z.object({
	name: z.string().optional(),
}).optional(),
	spec: z.record(z.string(), z.unknown()).describe("Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)"),
});

export const AnnotationPanelFilterSchema = z.object({
	exclude: z.boolean().optional().default(false).describe("When true, the listed panels are excluded; otherwise only those panels show the annotation"),
	ids: z.array(z.number().int()).describe("Panel IDs that should be included or excluded"),
});

// Annotation Query placement. Defines where the annotation query should be displayed.
// - "inControlsMenu" renders the annotation query in the dashboard controls dropdown menu
export const AnnotationQueryPlacement = "inControlsMenu";
export type AnnotationQueryPlacement = typeof AnnotationQueryPlacement;

export const AnnotationEventFieldMappingSchema = z.object({
	source: z.string().optional().default("field").describe("Source type for the field value"),
	value: z.string().optional().describe("Constant value to use when source is \"text\""),
	regex: z.string().optional().describe("Regular expression to apply to the field value"),
}).describe("Annotation event field mapping. Defines how to map a data frame field to an annotation event field.");

export const DashboardCursorSyncSchema = z.enum(["Crosshair", "Tooltip", "Off"]).describe("\"Off\" for no shared crosshair or tooltip (default).\n\"Crosshair\" for shared crosshair.\n\"Tooltip\" for shared crosshair AND shared tooltip.");

export const ElementSchema = z.discriminatedUnion("kind", [z.lazy(() => PanelKindSchema), z.lazy(() => LibraryPanelKindSchema)]).describe("Supported dashboard elements\n|* more element types in the future");

export const PanelKindSchema = z.object({
	kind: z.literal("Panel").optional().default("Panel"),
	spec: z.lazy(() => PanelSpecSchema),
});

export const PanelSpecSchema = z.object({
	id: z.number(),
	title: z.string(),
	description: z.string(),
	links: z.array(z.lazy(() => DataLinkSchema)),
	data: z.lazy(() => QueryGroupKindSchema),
	vizConfig: z.lazy(() => VizConfigKindSchema),
	transparent: z.boolean().optional(),
});

export const DataLinkSchema = z.object({
	title: z.string(),
	url: z.string(),
	targetBlank: z.boolean().optional(),
});

export const QueryGroupKindSchema = z.object({
	kind: z.literal("QueryGroup").optional().default("QueryGroup"),
	spec: z.lazy(() => QueryGroupSpecSchema),
});

export const QueryGroupSpecSchema = z.object({
	queries: z.array(z.lazy(() => PanelQueryKindSchema)),
	transformations: z.array(z.lazy(() => TransformationKindSchema)),
	queryOptions: z.lazy(() => QueryOptionsSpecSchema),
});

export const PanelQueryKindSchema = z.object({
	kind: z.literal("PanelQuery").optional().default("PanelQuery"),
	spec: z.lazy(() => PanelQuerySpecSchema),
});

export const PanelQuerySpecSchema = z.object({
	query: z.lazy(() => DataQueryKindSchema),
	refId: z.string().optional().default("A"),
	hidden: z.boolean(),
});

export const TransformationKindSchema = z.object({
	kind: z.string().describe("The kind of a TransformationKind is the transformation ID"),
	spec: z.lazy(() => DataTransformerConfigSchema),
});

export const DataTransformerConfigSchema = z.object({
	id: z.string().describe("Unique identifier of transformer"),
	disabled: z.boolean().optional().describe("Disabled transformations are skipped"),
	filter: z.lazy(() => MatcherConfigSchema).optional().describe("Optional frame matcher. When missing it will be applied to all results"),
	topic: z.lazy(() => DataTopicSchema).optional().describe("Where to pull DataFrames from as input to transformation"),
	options: z.unknown().describe("Options to be passed to the transformer\nValid options depend on the transformer id"),
}).describe("Transformations allow to manipulate data returned by a query before the system applies a visualization.\nUsing transformations you can: rename fields, join time series data, perform mathematical operations across queries,\nuse the output of one transformation as the input to another transformation, etc.");

export const MatcherConfigSchema = z.object({
	id: z.string().optional().default("").describe("The matcher id. This is used to find the matcher implementation from registry."),
	scope: z.lazy(() => MatcherScopeSchema).optional().describe("If set, limits this matcher to fields of that type. If not set, \"series\" mode is used."),
	options: z.unknown().optional().describe("The matcher options. This is specific to the matcher implementation."),
}).describe("Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.\nIt comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.");

export const MatcherScopeSchema = z.enum(["series", "nested", "annotation", "exemplar"]);

export const DataTopicSchema = z.enum(["series", "annotations", "alertStates"]).describe("A topic is attached to DataFrame metadata in query results.\nThis specifies where the data should be used.");

export const QueryOptionsSpecSchema = z.object({
	timeFrom: z.string().optional(),
	maxDataPoints: z.number().int().optional(),
	timeShift: z.string().optional(),
	queryCachingTTL: z.number().int().optional(),
	interval: z.string().optional(),
	cacheTimeout: z.string().optional(),
	hideTimeOverride: z.boolean().optional(),
	timeCompare: z.string().optional(),
});

export const VizConfigKindSchema = z.object({
	kind: z.literal("VizConfig").optional().default("VizConfig"),
	group: z.string().describe("The group is the plugin ID"),
	version: z.string(),
	spec: z.lazy(() => VizConfigSpecSchema),
});

export const VizConfigSpecSchema = z.object({
	options: z.record(z.string(), z.unknown()),
	fieldConfig: z.lazy(() => FieldConfigSourceSchema),
}).describe("--- Kinds ---");

export const FieldConfigSourceSchema = z.object({
	defaults: z.lazy(() => FieldConfigSchema).describe("Defaults are the options applied to all fields."),
	overrides: z.array(z.object({
	__systemRef: z.string().optional().describe("Describes config override rules created when interacting with Grafana."),
	matcher: z.lazy(() => MatcherConfigSchema),
	properties: z.array(z.lazy(() => DynamicConfigValueSchema)),
})).describe("Overrides are the options applied to specific fields overriding the defaults."),
}).describe("The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.");

export const FieldConfigSchema = z.object({
	displayName: z.string().optional().describe("The display value for this field.  This supports template variables blank is auto"),
	displayNameFromDS: z.string().optional().describe("This can be used by data sources that return and explicit naming structure for values and labels\nWhen this property is configured, this value is used rather than the default naming strategy."),
	description: z.string().optional().describe("Human readable field metadata"),
	path: z.string().optional().describe("An explicit path to the field in the datasource.  When the frame meta includes a path,\nThis will default to `${frame.meta.path}/${field.name}\n\nWhen defined, this value can be used as an identifier within the datasource scope, and\nmay be used to update the results"),
	writeable: z.boolean().optional().describe("True if data source can write a value to the path. Auth/authz are supported separately"),
	filterable: z.boolean().optional().describe("True if data source field supports ad-hoc filters"),
	unit: z.string().optional().describe("Unit a field should use. The unit you select is applied to all fields except time.\nYou can use the units ID available in Grafana or a custom unit.\nAvailable units in Grafana: https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts\nAs custom unit, you can use the following formats:\n`suffix:\u003csuffix\u003e` for custom unit that should go after value.\n`prefix:\u003cprefix\u003e` for custom unit that should go before value.\n`time:\u003cformat\u003e` For custom date time formats type for example `time:YYYY-MM-DD`.\n`si:\u003cbase scale\u003e\u003cunit characters\u003e` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that SI scale character.\n`count:\u003cunit\u003e` for a custom count unit.\n`currency:\u003cunit\u003e` for custom a currency unit."),
	decimals: z.number().optional().describe("Specify the number of decimals Grafana includes in the rendered value.\nIf you leave this field blank, Grafana automatically truncates the number of decimals based on the value.\nFor example 1.1234 will display as 1.12 and 100.456 will display as 100.\nTo display all decimals, set the unit to `String`."),
	min: z.number().optional().describe("The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields."),
	max: z.number().optional().describe("The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields."),
	mappings: z.array(z.lazy(() => ValueMappingSchema)).optional().describe("Convert input values into a display string"),
	thresholds: z.lazy(() => ThresholdsConfigSchema).optional().describe("Map numeric values to states"),
	color: z.lazy(() => FieldColorSchema).optional().describe("Panel color configuration"),
	links: z.array(z.unknown()).optional().describe("The behavior when clicking on a result"),
	actions: z.array(z.lazy(() => ActionSchema)).optional().describe("Define interactive HTTP requests that can be triggered from data visualizations."),
	noValue: z.string().optional().describe("Alternative to empty string"),
	custom: z.record(z.string(), z.unknown()).optional().describe("custom is specified by the FieldConfig field\nin panel plugin schemas."),
	fieldMinMax: z.boolean().optional().describe("Calculate min max per field"),
	nullValueMode: z.lazy(() => NullValueModeSchema).optional().describe("How null values should be handled when calculating field stats\n\"null\" - Include null values, \"connected\" - Ignore nulls, \"null as zero\" - Treat nulls as zero"),
}).describe("The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.");

export const ValueMappingSchema = z.discriminatedUnion("type", [z.lazy(() => ValueMapSchema), z.lazy(() => RangeMapSchema), z.lazy(() => RegexMapSchema), z.lazy(() => SpecialValueMapSchema)]);

export const ValueMapSchema = z.object({
	type: z.literal("value").optional().default("value"),
	options: z.record(z.string(), z.lazy(() => ValueMappingResultSchema)).describe("Map with \u003cvalue_to_match\u003e: ValueMappingResult. For example: { \"10\": { text: \"Perfection!\", color: \"green\" } }"),
}).describe("Maps text values to a color or different display text and color.\nFor example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.");

export const MappingTypeSchema = z.enum(["value", "range", "regex", "special"]).describe("Supported value mapping types\n`value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.\n`range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.\n`regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.\n`special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.");

export const ValueMappingResultSchema = z.object({
	text: z.string().optional().describe("Text to display when the value matches"),
	color: z.string().optional().describe("Text to use when the value matches"),
	icon: z.string().optional().describe("Icon to display when the value matches. Only specific visualizations."),
	index: z.number().int().optional().describe("Position in the mapping array. Only used internally."),
}).describe("Result used as replacement with text and color when the value matches");

export const RangeMapSchema = z.object({
	type: z.literal("range").optional().default("range"),
	options: z.object({
	from: z.number().nullable().describe("Min value of the range. It can be null which means -Infinity"),
	to: z.number().nullable().describe("Max value of the range. It can be null which means +Infinity"),
	result: z.lazy(() => ValueMappingResultSchema).describe("Config to apply when the value is within the range"),
}).describe("Range to match against and the result to apply when the value is within the range"),
}).describe("Maps numerical ranges to a display text and color.\nFor example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.");

export const RegexMapSchema = z.object({
	type: z.literal("regex").optional().default("regex"),
	options: z.object({
	pattern: z.string().describe("Regular expression to match against"),
	result: z.lazy(() => ValueMappingResultSchema).describe("Config to apply when the value matches the regex"),
}).describe("Regular expression to match against and the result to apply when the value matches the regex"),
}).describe("Maps regular expressions to replacement text and a color.\nFor example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.");

export const SpecialValueMapSchema = z.object({
	type: z.literal("special").optional().default("special"),
	options: z.object({
	match: z.lazy(() => SpecialValueMatchSchema).describe("Special value to match against"),
	result: z.lazy(() => ValueMappingResultSchema).describe("Config to apply when the value matches the special value"),
}),
}).describe("Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.\nSee SpecialValueMatch to see the list of special values.\nFor example, you can configure a special value mapping so that null values appear as N/A.");

export const SpecialValueMatchSchema = z.enum(["true", "false", "null", "nan", "null+nan", "empty"]).describe("Special value types supported by the `SpecialValueMap`");

export const ThresholdsConfigSchema = z.object({
	mode: z.lazy(() => ThresholdsModeSchema),
	steps: z.array(z.lazy(() => ThresholdSchema)),
});

export const ThresholdsModeSchema = z.enum(["absolute", "percentage"]);

export const ThresholdSchema = z.object({
	value: z.number().nullable().describe("Value null means -Infinity"),
	color: z.string(),
});

export const FieldColorSchema = z.object({
	mode: z.lazy(() => FieldColorModeIdSchema).describe("The main color scheme mode."),
	fixedColor: z.string().optional().describe("The fixed color value for fixed or shades color modes."),
	seriesBy: z.lazy(() => FieldColorSeriesByModeSchema).optional().describe("Some visualizations need to know how to assign a series color from by value color schemes."),
}).describe("Map a field to a color.");

export const FieldColorModeIdSchema = z.enum(["thresholds", "palette-classic", "palette-classic-by-name", "continuous-viridis", "continuous-magma", "continuous-plasma", "continuous-inferno", "continuous-cividis", "continuous-GrYlRd", "continuous-RdYlGr", "continuous-BlYlRd", "continuous-YlRd", "continuous-BlPu", "continuous-YlBl", "continuous-blues", "continuous-reds", "continuous-greens", "continuous-purples", "fixed", "shades"]).describe("Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.\nContinuous color interpolates a color using the percentage of a value relative to min and max.\nAccepted values are:\n`thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold\n`palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations\n`palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations\n`continuous-viridis`: Continuous Viridis palette mode\n`continuous-magma`: Continuous Magma palette mode\n`continuous-plasma`: Continuous Plasma palette mode\n`continuous-inferno`: Continuous Inferno palette mode\n`continuous-cividis`: Continuous Cividis palette mode\n`continuous-GrYlRd`: Continuous Green-Yellow-Red palette mode\n`continuous-RdYlGr`: Continuous Red-Yellow-Green palette mode\n`continuous-BlYlRd`: Continuous Blue-Yellow-Red palette mode\n`continuous-YlRd`: Continuous Yellow-Red palette mode\n`continuous-BlPu`: Continuous Blue-Purple palette mode\n`continuous-YlBl`: Continuous Yellow-Blue palette mode\n`continuous-blues`: Continuous Blue palette mode\n`continuous-reds`: Continuous Red palette mode\n`continuous-greens`: Continuous Green palette mode\n`continuous-purples`: Continuous Purple palette mode\n`shades`: Shades of a single color. Specify a single color, useful in an override rule.\n`fixed`: Fixed color mode. Specify a single color, useful in an override rule.");

export const FieldColorSeriesByModeSchema = z.enum(["min", "max", "last"]).describe("Defines how to assign a series color from \"by value\" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.");

export const ActionSchema = z.object({
	type: z.lazy(() => ActionTypeSchema),
	title: z.string(),
	fetch: z.lazy(() => FetchOptionsSchema).optional(),
	infinity: z.lazy(() => InfinityOptionsSchema).optional(),
	confirmation: z.string().optional(),
	oneClick: z.boolean().optional(),
	variables: z.array(z.lazy(() => ActionVariableSchema)).optional(),
	style: z.object({
	backgroundColor: z.string().optional(),
}).optional(),
});

export const ActionTypeSchema = z.enum(["fetch", "infinity"]);

export const FetchOptionsSchema = z.object({
	method: z.lazy(() => HttpRequestMethodSchema),
	url: z.string(),
	body: z.string().optional(),
	queryParams: z.array(z.array(z.string())).optional().describe("These are 2D arrays of strings, each representing a key-value pair\nWe are defining them this way because we can't generate a go struct that\nthat would have exactly two strings in each sub-array"),
	headers: z.array(z.array(z.string())).optional(),
});

export const HttpRequestMethodSchema = z.enum(["GET", "PUT", "POST", "DELETE", "PATCH"]);

export const InfinityOptionsSchema = z.object({
	method: z.lazy(() => HttpRequestMethodSchema),
	url: z.string(),
	body: z.string().optional(),
	queryParams: z.array(z.array(z.string())).optional().describe("These are 2D arrays of strings, each representing a key-value pair\nWe are defining them this way because we can't generate a go struct that\nthat would have exactly two strings in each sub-array"),
	datasourceUid: z.string(),
	headers: z.array(z.array(z.string())).optional(),
});

export const ActionVariableSchema = z.object({
	key: z.string(),
	name: z.string(),
	type: z.literal("string").optional().default("string"),
});

// Action variable type
export const ActionVariableType = "string";
export type ActionVariableType = typeof ActionVariableType;

export const NullValueModeSchema = z.enum(["null", "connected", "null as zero"]).describe("How null values should be handled");

export const DynamicConfigValueSchema = z.object({
	id: z.string().optional().default(""),
	value: z.unknown().optional(),
});

export const LibraryPanelKindSchema = z.object({
	kind: z.literal("LibraryPanel").optional().default("LibraryPanel"),
	spec: z.lazy(() => LibraryPanelKindSpecSchema),
});

export const LibraryPanelKindSpecSchema = z.object({
	id: z.number().describe("Panel ID for the library panel in the dashboard"),
	title: z.string().describe("Title for the library panel in the dashboard"),
	libraryPanel: z.lazy(() => LibraryPanelRefSchema),
});

export const LibraryPanelRefSchema = z.object({
	name: z.string().describe("Library panel name"),
	uid: z.string().describe("Library panel uid"),
}).describe("A library panel is a reusable panel that you can use in any dashboard.\nWhen you make a change to a library panel, that change propagates to all instances of where the panel is used.\nLibrary panels streamline reuse of panels across multiple dashboards.");

export const GridLayoutKindSchema = z.object({
	kind: z.literal("GridLayout").optional().default("GridLayout"),
	spec: z.lazy(() => GridLayoutSpecSchema),
});

export const GridLayoutSpecSchema = z.object({
	items: z.array(z.lazy(() => GridLayoutItemKindSchema)),
});

export const GridLayoutItemKindSchema = z.object({
	kind: z.literal("GridLayoutItem").optional().default("GridLayoutItem"),
	spec: z.lazy(() => GridLayoutItemSpecSchema),
});

export const GridLayoutItemSpecSchema = z.object({
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int(),
	height: z.number().int(),
	element: z.lazy(() => ElementReferenceSchema).describe("reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference"),
	repeat: z.lazy(() => RepeatOptionsSchema).optional(),
});

export const ElementReferenceSchema = z.object({
	kind: z.literal("ElementReference").optional().default("ElementReference"),
	name: z.string(),
});

export const RepeatOptionsSchema = z.object({
	mode: z.literal("variable").optional().default("variable"),
	value: z.string(),
	direction: z.enum(["h", "v"]).optional(),
	maxPerRow: z.number().int().optional(),
});

// other repeat modes will be added in the future: label, frame
export const RepeatMode = "variable";
export type RepeatMode = typeof RepeatMode;

export const RowsLayoutKindSchema = z.object({
	kind: z.literal("RowsLayout").optional().default("RowsLayout"),
	spec: z.lazy(() => RowsLayoutSpecSchema),
});

export const RowsLayoutSpecSchema = z.object({
	rows: z.array(z.lazy(() => RowsLayoutRowKindSchema)),
});

export const RowsLayoutRowKindSchema = z.object({
	kind: z.literal("RowsLayoutRow").optional().default("RowsLayoutRow"),
	spec: z.lazy(() => RowsLayoutRowSpecSchema),
});

export const RowsLayoutRowSpecSchema = z.object({
	title: z.string().optional(),
	collapse: z.boolean().optional(),
	hideHeader: z.boolean().optional(),
	fillScreen: z.boolean().optional(),
	conditionalRendering: z.lazy(() => ConditionalRenderingGroupKindSchema).optional(),
	repeat: z.lazy(() => RowRepeatOptionsSchema).optional(),
	layout: z.discriminatedUnion("kind", [z.lazy(() => GridLayoutKindSchema), z.lazy(() => AutoGridLayoutKindSchema), z.lazy(() => TabsLayoutKindSchema), z.lazy(() => RowsLayoutKindSchema)]),
	variables: z.array(z.lazy(() => VariableKindSchema)).optional(),
});

export const ConditionalRenderingGroupKindSchema = z.object({
	kind: z.literal("ConditionalRenderingGroup").optional().default("ConditionalRenderingGroup"),
	spec: z.lazy(() => ConditionalRenderingGroupSpecSchema),
});

export const ConditionalRenderingGroupSpecSchema = z.object({
	visibility: z.enum(["show", "hide"]),
	condition: z.enum(["and", "or"]),
	items: z.array(z.discriminatedUnion("kind", [z.lazy(() => ConditionalRenderingVariableKindSchema), z.lazy(() => ConditionalRenderingDataKindSchema), z.lazy(() => ConditionalRenderingTimeRangeSizeKindSchema)])),
});

export const ConditionalRenderingVariableKindSchema = z.object({
	kind: z.literal("ConditionalRenderingVariable").optional().default("ConditionalRenderingVariable"),
	spec: z.lazy(() => ConditionalRenderingVariableSpecSchema),
});

export const ConditionalRenderingVariableSpecSchema = z.object({
	variable: z.string(),
	operator: z.enum(["equals", "notEquals", "matches", "notMatches"]),
	value: z.string(),
});

export const ConditionalRenderingDataKindSchema = z.object({
	kind: z.literal("ConditionalRenderingData").optional().default("ConditionalRenderingData"),
	spec: z.lazy(() => ConditionalRenderingDataSpecSchema),
});

export const ConditionalRenderingDataSpecSchema = z.object({
	value: z.boolean(),
});

export const ConditionalRenderingTimeRangeSizeKindSchema = z.object({
	kind: z.literal("ConditionalRenderingTimeRangeSize").optional().default("ConditionalRenderingTimeRangeSize"),
	spec: z.lazy(() => ConditionalRenderingTimeRangeSizeSpecSchema),
});

export const ConditionalRenderingTimeRangeSizeSpecSchema = z.object({
	value: z.string(),
});

export const RowRepeatOptionsSchema = z.object({
	mode: z.literal("variable").optional().default("variable"),
	value: z.string(),
});

export const AutoGridLayoutKindSchema = z.object({
	kind: z.literal("AutoGridLayout").optional().default("AutoGridLayout"),
	spec: z.lazy(() => AutoGridLayoutSpecSchema),
});

export const AutoGridLayoutSpecSchema = z.object({
	maxColumnCount: z.number().optional().default(3),
	columnWidthMode: z.enum(["narrow", "standard", "wide", "custom"]).optional().default("standard"),
	columnWidth: z.number().optional(),
	rowHeightMode: z.enum(["short", "standard", "tall", "custom"]).optional().default("standard"),
	rowHeight: z.number().optional(),
	fillScreen: z.boolean().optional().default(false),
	items: z.array(z.lazy(() => AutoGridLayoutItemKindSchema)),
});

export const AutoGridLayoutItemKindSchema = z.object({
	kind: z.literal("AutoGridLayoutItem").optional().default("AutoGridLayoutItem"),
	spec: z.lazy(() => AutoGridLayoutItemSpecSchema),
});

export const AutoGridLayoutItemSpecSchema = z.object({
	element: z.lazy(() => ElementReferenceSchema),
	repeat: z.lazy(() => AutoGridRepeatOptionsSchema).optional(),
	conditionalRendering: z.lazy(() => ConditionalRenderingGroupKindSchema).optional(),
});

export const AutoGridRepeatOptionsSchema = z.object({
	mode: z.literal("variable").optional().default("variable"),
	value: z.string(),
});

export const TabsLayoutKindSchema = z.object({
	kind: z.literal("TabsLayout").optional().default("TabsLayout"),
	spec: z.lazy(() => TabsLayoutSpecSchema),
});

export const TabsLayoutSpecSchema = z.object({
	tabs: z.array(z.lazy(() => TabsLayoutTabKindSchema)),
});

export const TabsLayoutTabKindSchema = z.object({
	kind: z.literal("TabsLayoutTab").optional().default("TabsLayoutTab"),
	spec: z.lazy(() => TabsLayoutTabSpecSchema),
});

export const TabsLayoutTabSpecSchema = z.object({
	title: z.string().optional(),
	layout: z.discriminatedUnion("kind", [z.lazy(() => GridLayoutKindSchema), z.lazy(() => RowsLayoutKindSchema), z.lazy(() => AutoGridLayoutKindSchema), z.lazy(() => TabsLayoutKindSchema)]),
	conditionalRendering: z.lazy(() => ConditionalRenderingGroupKindSchema).optional(),
	repeat: z.lazy(() => TabRepeatOptionsSchema).optional(),
	variables: z.array(z.lazy(() => VariableKindSchema)).optional(),
});

export const TabRepeatOptionsSchema = z.object({
	mode: z.literal("variable").optional().default("variable"),
	value: z.string(),
});

export const VariableKindSchema = z.discriminatedUnion("kind", [z.lazy(() => QueryVariableKindSchema), z.lazy(() => TextVariableKindSchema), z.lazy(() => ConstantVariableKindSchema), z.lazy(() => DatasourceVariableKindSchema), z.lazy(() => IntervalVariableKindSchema), z.lazy(() => CustomVariableKindSchema), z.lazy(() => GroupByVariableKindSchema), z.lazy(() => AdhocVariableKindSchema), z.lazy(() => SwitchVariableKindSchema)]);

export const QueryVariableKindSchema = z.object({
	kind: z.literal("QueryVariable").optional().default("QueryVariable"),
	spec: z.lazy(() => QueryVariableSpecSchema),
}).describe("Query variable kind");

export const QueryVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	refresh: z.lazy(() => VariableRefreshSchema).optional().default("never"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	query: z.lazy(() => DataQueryKindSchema),
	regex: z.string().optional().default(""),
	regexApplyTo: z.lazy(() => VariableRegexApplyToSchema).optional().default("value"),
	sort: z.lazy(() => VariableSortSchema),
	definition: z.string().optional(),
	options: z.array(z.lazy(() => VariableOptionSchema)),
	multi: z.boolean().optional().default(false),
	includeAll: z.boolean().optional().default(false),
	allValue: z.string().optional(),
	placeholder: z.string().optional(),
	allowCustomValue: z.boolean().optional().default(true),
	staticOptions: z.array(z.lazy(() => VariableOptionSchema)).optional(),
	staticOptionsOrder: z.enum(["before", "after", "sorted"]).optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Query variable specification");

export const VariableOptionSchema = z.object({
	selected: z.boolean().optional().describe("Whether the option is selected or not"),
	text: z.union([z.string(), z.array(z.string())]).describe("Text to be displayed for the option"),
	value: z.union([z.string(), z.array(z.string())]).describe("Value of the option"),
	properties: z.record(z.string(), z.string()).optional().describe("Additional properties for multi-props variables"),
}).describe("Variable option specification");

export const VariableHideSchema = z.enum(["dontHide", "hideLabel", "hideVariable", "inControlsMenu"]).describe("Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).");

export const VariableRefreshSchema = z.enum(["never", "onDashboardLoad", "onTimeRangeChanged"]).describe("Options to config when to refresh a variable\n`never`: Never refresh the variable\n`onDashboardLoad`: Queries the data source every time the dashboard loads.\n`onTimeRangeChanged`: Queries the data source when the dashboard time range changes.");

export const VariableRegexApplyToSchema = z.enum(["value", "text"]).describe("Determine whether regex applies to variable value or display text\nAccepted values are `value` (apply to value used in queries) or `text` (apply to display text shown to users)");

export const VariableSortSchema = z.enum(["disabled", "alphabeticalAsc", "alphabeticalDesc", "numericalAsc", "numericalDesc", "alphabeticalCaseInsensitiveAsc", "alphabeticalCaseInsensitiveDesc", "naturalAsc", "naturalDesc"]).describe("Sort variable options\nAccepted values are:\n`disabled`: No sorting\n`alphabeticalAsc`: Alphabetical ASC\n`alphabeticalDesc`: Alphabetical DESC\n`numericalAsc`: Numerical ASC\n`numericalDesc`: Numerical DESC\n`alphabeticalCaseInsensitiveAsc`: Alphabetical Case Insensitive ASC\n`alphabeticalCaseInsensitiveDesc`: Alphabetical Case Insensitive DESC\n`naturalAsc`: Natural ASC\n`naturalDesc`: Natural DESC\nVariableSort enum with default value");

export const ControlSourceRefSchema = z.lazy(() => DatasourceControlSourceRefSchema);

export const DatasourceControlSourceRefSchema = z.object({
	type: z.literal("datasource").optional().default("datasource"),
	group: z.string().describe("The plugin type-id"),
}).describe("Source information for controls (e.g. variables or links)");

export const TextVariableKindSchema = z.object({
	kind: z.literal("TextVariable").optional().default("TextVariable"),
	spec: z.lazy(() => TextVariableSpecSchema),
}).describe("Text variable kind");

export const TextVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	query: z.string().optional().default(""),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Text variable specification");

export const ConstantVariableKindSchema = z.object({
	kind: z.literal("ConstantVariable").optional().default("ConstantVariable"),
	spec: z.lazy(() => ConstantVariableSpecSchema),
}).describe("Constant variable kind");

export const ConstantVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	query: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Constant variable specification");

export const DatasourceVariableKindSchema = z.object({
	kind: z.literal("DatasourceVariable").optional().default("DatasourceVariable"),
	spec: z.lazy(() => DatasourceVariableSpecSchema),
}).describe("Datasource variable kind");

export const DatasourceVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	pluginId: z.string().optional().default(""),
	refresh: z.lazy(() => VariableRefreshSchema).optional().default("never"),
	regex: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	options: z.array(z.lazy(() => VariableOptionSchema)),
	multi: z.boolean().optional().default(false),
	includeAll: z.boolean().optional().default(false),
	allValue: z.string().optional(),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	allowCustomValue: z.boolean().optional().default(true),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Datasource variable specification");

export const IntervalVariableKindSchema = z.object({
	kind: z.literal("IntervalVariable").optional().default("IntervalVariable"),
	spec: z.lazy(() => IntervalVariableSpecSchema),
}).describe("Interval variable kind");

export const IntervalVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	query: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	options: z.array(z.lazy(() => VariableOptionSchema)),
	auto: z.boolean().optional().default(false),
	auto_min: z.string().optional().default(""),
	auto_count: z.number().int().optional().default(0),
	refresh: z.literal("onTimeRangeChanged").optional().default("onTimeRangeChanged"),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Interval variable specification");

export const CustomVariableKindSchema = z.object({
	kind: z.literal("CustomVariable").optional().default("CustomVariable"),
	spec: z.lazy(() => CustomVariableSpecSchema),
}).describe("Custom variable kind");

export const CustomVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	query: z.string().optional().default(""),
	current: z.lazy(() => VariableOptionSchema),
	options: z.array(z.lazy(() => VariableOptionSchema)),
	multi: z.boolean().optional().default(false),
	includeAll: z.boolean().optional().default(false),
	allValue: z.string().optional(),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	allowCustomValue: z.boolean().optional().default(true),
	valuesFormat: z.enum(["csv", "json"]).optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Custom variable specification");

export const GroupByVariableKindSchema = z.object({
	kind: z.literal("GroupByVariable").optional().default("GroupByVariable"),
	group: z.string(),
	labels: z.record(z.string(), z.string()).optional(),
	datasource: z.object({
	name: z.string().optional(),
}).optional(),
	spec: z.lazy(() => GroupByVariableSpecSchema),
}).describe("Group variable kind");

export const GroupByVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	defaultValue: z.lazy(() => VariableOptionSchema).optional(),
	current: z.lazy(() => VariableOptionSchema).optional().default({text: "", value: ""}),
	options: z.array(z.lazy(() => VariableOptionSchema)),
	multi: z.boolean().optional().default(false),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("GroupBy variable specification");

export const AdhocVariableKindSchema = z.object({
	kind: z.literal("AdhocVariable").optional().default("AdhocVariable"),
	group: z.string(),
	labels: z.record(z.string(), z.string()).optional(),
	datasource: z.object({
	name: z.string().optional(),
}).optional(),
	spec: z.lazy(() => AdhocVariableSpecSchema),
}).describe("Adhoc variable kind");

export const AdhocVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	baseFilters: z.array(z.lazy(() => AdHocFilterWithLabelsSchema)),
	filters: z.array(z.lazy(() => AdHocFilterWithLabelsSchema)),
	defaultKeys: z.array(z.lazy(() => MetricFindValueSchema)),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	allowCustomValue: z.boolean().optional().default(true),
	enableGroupBy: z.boolean().optional().default(false).describe("Whether the group-by operator is enabled in the ad hoc filter combobox."),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
}).describe("Adhoc variable specification");

export const AdHocFilterWithLabelsSchema = z.object({
	key: z.string(),
	operator: z.string(),
	value: z.string(),
	values: z.array(z.string()).optional(),
	keyLabel: z.string().optional(),
	valueLabels: z.array(z.string()).optional(),
	forceEdit: z.boolean().optional(),
	origin: z.literal("dashboard").optional(),
	condition: z.string().optional().describe("@deprecated"),
}).describe("Define the AdHocFilterWithLabels type");

// Determine the origin of the adhoc variable filter
export const FilterOrigin = "dashboard";
export type FilterOrigin = typeof FilterOrigin;

export const MetricFindValueSchema = z.object({
	text: z.string(),
	value: z.union([z.string(), z.number()]).optional(),
	group: z.string().optional(),
	expandable: z.boolean().optional(),
}).describe("Define the MetricFindValue type");

export const SwitchVariableKindSchema = z.object({
	kind: z.literal("SwitchVariable").optional().default("SwitchVariable"),
	spec: z.lazy(() => SwitchVariableSpecSchema),
});

export const SwitchVariableSpecSchema = z.object({
	name: z.string().optional().default(""),
	current: z.string().optional().default("false"),
	enabledValue: z.string().optional().default("true"),
	disabledValue: z.string().optional().default("false"),
	label: z.string().optional(),
	hide: z.lazy(() => VariableHideSchema).optional().default("dontHide"),
	skipUrlSync: z.boolean().optional().default(false),
	description: z.string().optional(),
	origin: z.lazy(() => ControlSourceRefSchema).optional(),
});

export const DashboardLinkSchema = z.object({
	title: z.string().describe("Title to display with the link"),
	type: z.lazy(() => DashboardLinkTypeSchema).describe("Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)\nFIXME: The type is generated as `type: DashboardLinkType | dashboardLinkType.Link;` but it should be `type: DashboardLinkType`"),
	icon: z.string().describe("Icon name to be displayed with the link"),
	tooltip: z.string().describe("Tooltip to display when the user hovers their mouse over it"),
	url: z.string().optional().describe("Link URL. Only required/valid if the type is link"),
	tags: z.array(z.string()).describe("List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards"),
	asDropdown: z.boolean().optional().default(false).describe("If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards"),
	targetBlank: z.boolean().optional().default(false).describe("If true, the link will be opened in a new tab"),
	includeVars: z.boolean().optional().default(false).describe("If true, includes current template variables values in the link as query params"),
	keepTime: z.boolean().optional().default(false).describe("If true, includes current time range in the link as query params"),
	placement: z.literal("inControlsMenu").optional().describe("Placement can be used to display the link somewhere else on the dashboard other than above the visualisations."),
	origin: z.lazy(() => ControlSourceRefSchema).optional().describe("The source that registered the link (if any)"),
}).describe("Links with references to other dashboards or external resources");

export const DashboardLinkTypeSchema = z.enum(["link", "dashboards"]).describe("Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)");

// Dashboard Link placement. Defines where the link should be displayed.
// - "inControlsMenu" renders the link in bottom part of the dashboard controls dropdown menu
export const DashboardLinkPlacement = "inControlsMenu";
export type DashboardLinkPlacement = typeof DashboardLinkPlacement;

export const TimeSettingsSpecSchema = z.object({
	timezone: z.string().optional().default("browser").describe("Timezone of dashboard. Accepted values are IANA TZDB zone ID or \"browser\" or \"utc\"."),
	from: z.string().optional().default("now-6h").describe("Start time range for dashboard.\nAccepted values are relative time strings like \"now-6h\" or absolute time strings like \"2020-07-10T08:00:00.000Z\"."),
	to: z.string().optional().default("now").describe("End time range for dashboard.\nAccepted values are relative time strings like \"now-6h\" or absolute time strings like \"2020-07-10T08:00:00.000Z\"."),
	autoRefresh: z.string().optional().default("").describe("Refresh rate of dashboard. Represented via interval string, e.g. \"5s\", \"1m\", \"1h\", \"1d\".\nv1: refresh"),
	autoRefreshIntervals: z.array(z.string()).optional().default(["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"]).describe("Interval options available in the refresh picker dropdown.\nv1: timepicker.refresh_intervals"),
	quickRanges: z.array(z.lazy(() => TimeRangeOptionSchema)).optional().describe("Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.\nv1: timepicker.quick_ranges , not exposed in the UI"),
	hideTimepicker: z.boolean().optional().default(false).describe("Whether timepicker is visible or not.\nv1: timepicker.hidden"),
	weekStart: z.enum(["saturday", "monday", "sunday"]).optional().describe("Day when the week starts. Expressed by the name of the day in lowercase, e.g. \"monday\"."),
	fiscalYearStartMonth: z.number().int().optional().default(0).describe("The month that the fiscal year starts on. 0 = January, 11 = December"),
	nowDelay: z.string().optional().describe("Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.\nv1: timepicker.nowDelay"),
}).describe("Time configuration\nIt defines the default time config for the time picker, the refresh picker for the specific dashboard.");

export const TimeRangeOptionSchema = z.object({
	display: z.string().optional().default("Last 6 hours"),
	from: z.string().optional().default("now-6h"),
	to: z.string().optional().default("now"),
});

export const AnnotationEventFieldSourceSchema = z.enum(["field", "text", "skip"]).describe("Annotation event field source. Defines how to obtain the value for an annotation event field.\n- \"field\": Find the value with a matching key (default)\n- \"text\": Write a constant string into the value\n- \"skip\": Do not include the field");

export const KindSchema = z.object({
	kind: z.string(),
	spec: z.unknown(),
	metadata: z.unknown().optional(),
}).describe("--- Common types ---");

export const VariableValueSchema = z.union([z.string(), z.boolean(), z.number(), z.lazy(() => CustomVariableValueSchema), z.array(z.lazy(() => VariableValueSingleSchema))]).describe("Variable types");

export const VariableValueSingleSchema = z.union([z.string(), z.boolean(), z.number(), z.lazy(() => CustomVariableValueSchema)]);

export const CustomVariableValueSchema = z.object({
	formatter: z.union([z.string(), z.lazy(() => VariableCustomFormatterFnSchema)]).describe("The format name or function used in the expression"),
}).describe("Custom variable value");

export const VariableCustomFormatterFnSchema = z.object({
	value: z.unknown(),
	legacyVariableModel: z.object({
	name: z.string(),
	type: z.lazy(() => VariableTypeSchema),
	multi: z.boolean(),
	includeAll: z.boolean(),
}),
	legacyDefaultFormatter: z.lazy(() => VariableCustomFormatterFnSchema).optional(),
}).describe("Custom formatter function");

export const VariableTypeSchema = z.enum(["query", "adhoc", "groupby", "constant", "datasource", "interval", "textbox", "custom", "system", "snapshot", "switch"]).describe("Dashboard variable type\n`query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.\n`adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).\n`constant`: \tDefine a hidden constant.\n`datasource`: Quickly change the data source for an entire dashboard.\n`interval`: Interval variables represent time spans.\n`textbox`: Display a free text input field with an optional default value.\n`custom`: Define the variable options manually using a comma-separated list.\n`system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables");

export const CustomFormatterVariableSchema = z.object({
	name: z.string(),
	type: z.lazy(() => VariableTypeSchema),
	multi: z.boolean(),
	includeAll: z.boolean(),
}).describe("Custom formatter variable");

export const VariableValueOptionSchema = z.object({
	label: z.string(),
	value: z.lazy(() => VariableValueSingleSchema),
	group: z.string().optional(),
}).describe("FIXME: should we introduce this? --- Variable value option");


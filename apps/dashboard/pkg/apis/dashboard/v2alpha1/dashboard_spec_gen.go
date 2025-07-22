// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2alpha1

import (
	json "encoding/json"
	errors "errors"
)

// +k8s:openapi-gen=true
type DashboardAnnotationQueryKind struct {
	Kind string                       `json:"kind"`
	Spec DashboardAnnotationQuerySpec `json:"spec"`
}

// NewDashboardAnnotationQueryKind creates a new DashboardAnnotationQueryKind object.
func NewDashboardAnnotationQueryKind() *DashboardAnnotationQueryKind {
	return &DashboardAnnotationQueryKind{
		Kind: "AnnotationQuery",
		Spec: *NewDashboardAnnotationQuerySpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardAnnotationQuerySpec struct {
	Datasource *DashboardDataSourceRef         `json:"datasource,omitempty"`
	Query      *DashboardDataQueryKind         `json:"query,omitempty"`
	Enable     bool                            `json:"enable"`
	Hide       bool                            `json:"hide"`
	IconColor  string                          `json:"iconColor"`
	Name       string                          `json:"name"`
	BuiltIn    *bool                           `json:"builtIn,omitempty"`
	Filter     *DashboardAnnotationPanelFilter `json:"filter,omitempty"`
	// Catch-all field for datasource-specific properties
	LegacyOptions map[string]interface{} `json:"legacyOptions,omitempty"`
}

// NewDashboardAnnotationQuerySpec creates a new DashboardAnnotationQuerySpec object.
func NewDashboardAnnotationQuerySpec() *DashboardAnnotationQuerySpec {
	return &DashboardAnnotationQuerySpec{
		BuiltIn: (func(input bool) *bool { return &input })(false),
	}
}

// +k8s:openapi-gen=true
type DashboardDataSourceRef struct {
	// The plugin type-id
	Type *string `json:"type,omitempty"`
	// Specific datasource instance
	Uid *string `json:"uid,omitempty"`
}

// NewDashboardDataSourceRef creates a new DashboardDataSourceRef object.
func NewDashboardDataSourceRef() *DashboardDataSourceRef {
	return &DashboardDataSourceRef{}
}

// +k8s:openapi-gen=true
type DashboardDataQueryKind struct {
	// The kind of a DataQueryKind is the datasource type
	Kind string                 `json:"kind"`
	Spec map[string]interface{} `json:"spec"`
}

// NewDashboardDataQueryKind creates a new DashboardDataQueryKind object.
func NewDashboardDataQueryKind() *DashboardDataQueryKind {
	return &DashboardDataQueryKind{
		Spec: map[string]interface{}{},
	}
}

// +k8s:openapi-gen=true
type DashboardAnnotationPanelFilter struct {
	// Should the specified panels be included or excluded
	Exclude *bool `json:"exclude,omitempty"`
	// Panel IDs that should be included or excluded
	Ids []uint32 `json:"ids"`
}

// NewDashboardAnnotationPanelFilter creates a new DashboardAnnotationPanelFilter object.
func NewDashboardAnnotationPanelFilter() *DashboardAnnotationPanelFilter {
	return &DashboardAnnotationPanelFilter{
		Exclude: (func(input bool) *bool { return &input })(false),
		Ids:     []uint32{},
	}
}

// "Off" for no shared crosshair or tooltip (default).
// "Crosshair" for shared crosshair.
// "Tooltip" for shared crosshair AND shared tooltip.
// +k8s:openapi-gen=true
type DashboardDashboardCursorSync string

const (
	DashboardDashboardCursorSyncCrosshair DashboardDashboardCursorSync = "Crosshair"
	DashboardDashboardCursorSyncTooltip   DashboardDashboardCursorSync = "Tooltip"
	DashboardDashboardCursorSyncOff       DashboardDashboardCursorSync = "Off"
)

// Supported dashboard elements
// |* more element types in the future
// +k8s:openapi-gen=true
type DashboardElement = DashboardPanelKindOrLibraryPanelKind

// NewDashboardElement creates a new DashboardElement object.
func NewDashboardElement() *DashboardElement {
	return NewDashboardPanelKindOrLibraryPanelKind()
}

// +k8s:openapi-gen=true
type DashboardPanelKind struct {
	Kind string             `json:"kind"`
	Spec DashboardPanelSpec `json:"spec"`
}

// NewDashboardPanelKind creates a new DashboardPanelKind object.
func NewDashboardPanelKind() *DashboardPanelKind {
	return &DashboardPanelKind{
		Kind: "Panel",
		Spec: *NewDashboardPanelSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardPanelSpec struct {
	Id          float64                 `json:"id"`
	Title       string                  `json:"title"`
	Description string                  `json:"description"`
	Links       []DashboardDataLink     `json:"links"`
	Data        DashboardQueryGroupKind `json:"data"`
	VizConfig   DashboardVizConfigKind  `json:"vizConfig"`
	Transparent *bool                   `json:"transparent,omitempty"`
}

// NewDashboardPanelSpec creates a new DashboardPanelSpec object.
func NewDashboardPanelSpec() *DashboardPanelSpec {
	return &DashboardPanelSpec{
		Links:     []DashboardDataLink{},
		Data:      *NewDashboardQueryGroupKind(),
		VizConfig: *NewDashboardVizConfigKind(),
	}
}

// +k8s:openapi-gen=true
type DashboardDataLink struct {
	Title       string `json:"title"`
	Url         string `json:"url"`
	TargetBlank *bool  `json:"targetBlank,omitempty"`
}

// NewDashboardDataLink creates a new DashboardDataLink object.
func NewDashboardDataLink() *DashboardDataLink {
	return &DashboardDataLink{}
}

// +k8s:openapi-gen=true
type DashboardQueryGroupKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardQueryGroupSpec `json:"spec"`
}

// NewDashboardQueryGroupKind creates a new DashboardQueryGroupKind object.
func NewDashboardQueryGroupKind() *DashboardQueryGroupKind {
	return &DashboardQueryGroupKind{
		Kind: "QueryGroup",
		Spec: *NewDashboardQueryGroupSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardQueryGroupSpec struct {
	Queries         []DashboardPanelQueryKind     `json:"queries"`
	Transformations []DashboardTransformationKind `json:"transformations"`
	QueryOptions    DashboardQueryOptionsSpec     `json:"queryOptions"`
}

// NewDashboardQueryGroupSpec creates a new DashboardQueryGroupSpec object.
func NewDashboardQueryGroupSpec() *DashboardQueryGroupSpec {
	return &DashboardQueryGroupSpec{
		Queries:         []DashboardPanelQueryKind{},
		Transformations: []DashboardTransformationKind{},
		QueryOptions:    *NewDashboardQueryOptionsSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardPanelQueryKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardPanelQuerySpec `json:"spec"`
}

// NewDashboardPanelQueryKind creates a new DashboardPanelQueryKind object.
func NewDashboardPanelQueryKind() *DashboardPanelQueryKind {
	return &DashboardPanelQueryKind{
		Kind: "PanelQuery",
		Spec: *NewDashboardPanelQuerySpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardPanelQuerySpec struct {
	Query      DashboardDataQueryKind  `json:"query"`
	Datasource *DashboardDataSourceRef `json:"datasource,omitempty"`
	RefId      string                  `json:"refId"`
	Hidden     bool                    `json:"hidden"`
}

// NewDashboardPanelQuerySpec creates a new DashboardPanelQuerySpec object.
func NewDashboardPanelQuerySpec() *DashboardPanelQuerySpec {
	return &DashboardPanelQuerySpec{
		Query: *NewDashboardDataQueryKind(),
	}
}

// +k8s:openapi-gen=true
type DashboardTransformationKind struct {
	// The kind of a TransformationKind is the transformation ID
	Kind string                         `json:"kind"`
	Spec DashboardDataTransformerConfig `json:"spec"`
}

// NewDashboardTransformationKind creates a new DashboardTransformationKind object.
func NewDashboardTransformationKind() *DashboardTransformationKind {
	return &DashboardTransformationKind{
		Spec: *NewDashboardDataTransformerConfig(),
	}
}

// Transformations allow to manipulate data returned by a query before the system applies a visualization.
// Using transformations you can: rename fields, join time series data, perform mathematical operations across queries,
// use the output of one transformation as the input to another transformation, etc.
// +k8s:openapi-gen=true
type DashboardDataTransformerConfig struct {
	// Unique identifier of transformer
	Id string `json:"id"`
	// Disabled transformations are skipped
	Disabled *bool `json:"disabled,omitempty"`
	// Optional frame matcher. When missing it will be applied to all results
	Filter *DashboardMatcherConfig `json:"filter,omitempty"`
	// Where to pull DataFrames from as input to transformation
	Topic *DashboardDataTopic `json:"topic,omitempty"`
	// Options to be passed to the transformer
	// Valid options depend on the transformer id
	Options interface{} `json:"options"`
}

// NewDashboardDataTransformerConfig creates a new DashboardDataTransformerConfig object.
func NewDashboardDataTransformerConfig() *DashboardDataTransformerConfig {
	return &DashboardDataTransformerConfig{}
}

// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
// +k8s:openapi-gen=true
type DashboardMatcherConfig struct {
	// The matcher id. This is used to find the matcher implementation from registry.
	Id string `json:"id"`
	// The matcher options. This is specific to the matcher implementation.
	Options interface{} `json:"options,omitempty"`
}

// NewDashboardMatcherConfig creates a new DashboardMatcherConfig object.
func NewDashboardMatcherConfig() *DashboardMatcherConfig {
	return &DashboardMatcherConfig{
		Id: "",
	}
}

// A topic is attached to DataFrame metadata in query results.
// This specifies where the data should be used.
// +k8s:openapi-gen=true
type DashboardDataTopic string

const (
	DashboardDataTopicSeries      DashboardDataTopic = "series"
	DashboardDataTopicAnnotations DashboardDataTopic = "annotations"
	DashboardDataTopicAlertStates DashboardDataTopic = "alertStates"
)

// +k8s:openapi-gen=true
type DashboardQueryOptionsSpec struct {
	TimeFrom         *string `json:"timeFrom,omitempty"`
	MaxDataPoints    *int64  `json:"maxDataPoints,omitempty"`
	TimeShift        *string `json:"timeShift,omitempty"`
	QueryCachingTTL  *int64  `json:"queryCachingTTL,omitempty"`
	Interval         *string `json:"interval,omitempty"`
	CacheTimeout     *string `json:"cacheTimeout,omitempty"`
	HideTimeOverride *bool   `json:"hideTimeOverride,omitempty"`
}

// NewDashboardQueryOptionsSpec creates a new DashboardQueryOptionsSpec object.
func NewDashboardQueryOptionsSpec() *DashboardQueryOptionsSpec {
	return &DashboardQueryOptionsSpec{}
}

// +k8s:openapi-gen=true
type DashboardVizConfigKind struct {
	// The kind of a VizConfigKind is the plugin ID
	Kind string                 `json:"kind"`
	Spec DashboardVizConfigSpec `json:"spec"`
}

// NewDashboardVizConfigKind creates a new DashboardVizConfigKind object.
func NewDashboardVizConfigKind() *DashboardVizConfigKind {
	return &DashboardVizConfigKind{
		Spec: *NewDashboardVizConfigSpec(),
	}
}

// --- Kinds ---
// +k8s:openapi-gen=true
type DashboardVizConfigSpec struct {
	PluginVersion string                     `json:"pluginVersion"`
	Options       map[string]interface{}     `json:"options"`
	FieldConfig   DashboardFieldConfigSource `json:"fieldConfig"`
}

// NewDashboardVizConfigSpec creates a new DashboardVizConfigSpec object.
func NewDashboardVizConfigSpec() *DashboardVizConfigSpec {
	return &DashboardVizConfigSpec{
		Options:     map[string]interface{}{},
		FieldConfig: *NewDashboardFieldConfigSource(),
	}
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
// +k8s:openapi-gen=true
type DashboardFieldConfigSource struct {
	// Defaults are the options applied to all fields.
	Defaults DashboardFieldConfig `json:"defaults"`
	// Overrides are the options applied to specific fields overriding the defaults.
	Overrides []DashboardV2alpha1FieldConfigSourceOverrides `json:"overrides"`
}

// NewDashboardFieldConfigSource creates a new DashboardFieldConfigSource object.
func NewDashboardFieldConfigSource() *DashboardFieldConfigSource {
	return &DashboardFieldConfigSource{
		Defaults:  *NewDashboardFieldConfig(),
		Overrides: []DashboardV2alpha1FieldConfigSourceOverrides{},
	}
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
// +k8s:openapi-gen=true
type DashboardFieldConfig struct {
	// The display value for this field.  This supports template variables blank is auto
	DisplayName *string `json:"displayName,omitempty"`
	// This can be used by data sources that return and explicit naming structure for values and labels
	// When this property is configured, this value is used rather than the default naming strategy.
	DisplayNameFromDS *string `json:"displayNameFromDS,omitempty"`
	// Human readable field metadata
	Description *string `json:"description,omitempty"`
	// An explicit path to the field in the datasource.  When the frame meta includes a path,
	// This will default to `${frame.meta.path}/${field.name}
	//
	// When defined, this value can be used as an identifier within the datasource scope, and
	// may be used to update the results
	Path *string `json:"path,omitempty"`
	// True if data source can write a value to the path. Auth/authz are supported separately
	Writeable *bool `json:"writeable,omitempty"`
	// True if data source field supports ad-hoc filters
	Filterable *bool `json:"filterable,omitempty"`
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
	Unit *string `json:"unit,omitempty"`
	// Specify the number of decimals Grafana includes in the rendered value.
	// If you leave this field blank, Grafana automatically truncates the number of decimals based on the value.
	// For example 1.1234 will display as 1.12 and 100.456 will display as 100.
	// To display all decimals, set the unit to `String`.
	Decimals *float64 `json:"decimals,omitempty"`
	// The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
	Min *float64 `json:"min,omitempty"`
	// The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.
	Max *float64 `json:"max,omitempty"`
	// Convert input values into a display string
	Mappings []DashboardValueMapping `json:"mappings,omitempty"`
	// Map numeric values to states
	Thresholds *DashboardThresholdsConfig `json:"thresholds,omitempty"`
	// Panel color configuration
	Color *DashboardFieldColor `json:"color,omitempty"`
	// The behavior when clicking on a result
	Links []interface{} `json:"links,omitempty"`
	// Alternative to empty string
	NoValue *string `json:"noValue,omitempty"`
	// custom is specified by the FieldConfig field
	// in panel plugin schemas.
	Custom map[string]interface{} `json:"custom,omitempty"`
}

// NewDashboardFieldConfig creates a new DashboardFieldConfig object.
func NewDashboardFieldConfig() *DashboardFieldConfig {
	return &DashboardFieldConfig{}
}

// +k8s:openapi-gen=true
type DashboardValueMapping = DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap

// NewDashboardValueMapping creates a new DashboardValueMapping object.
func NewDashboardValueMapping() *DashboardValueMapping {
	return NewDashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap()
}

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// +k8s:openapi-gen=true
type DashboardValueMap struct {
	Type DashboardMappingType `json:"type"`
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	Options map[string]DashboardValueMappingResult `json:"options"`
}

// NewDashboardValueMap creates a new DashboardValueMap object.
func NewDashboardValueMap() *DashboardValueMap {
	return &DashboardValueMap{
		Type:    DashboardMappingTypeValue,
		Options: map[string]DashboardValueMappingResult{},
	}
}

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
// +k8s:openapi-gen=true
type DashboardMappingType string

const (
	DashboardMappingTypeValue   DashboardMappingType = "value"
	DashboardMappingTypeRange   DashboardMappingType = "range"
	DashboardMappingTypeRegex   DashboardMappingType = "regex"
	DashboardMappingTypeSpecial DashboardMappingType = "special"
)

// Result used as replacement with text and color when the value matches
// +k8s:openapi-gen=true
type DashboardValueMappingResult struct {
	// Text to display when the value matches
	Text *string `json:"text,omitempty"`
	// Text to use when the value matches
	Color *string `json:"color,omitempty"`
	// Icon to display when the value matches. Only specific visualizations.
	Icon *string `json:"icon,omitempty"`
	// Position in the mapping array. Only used internally.
	Index *int32 `json:"index,omitempty"`
}

// NewDashboardValueMappingResult creates a new DashboardValueMappingResult object.
func NewDashboardValueMappingResult() *DashboardValueMappingResult {
	return &DashboardValueMappingResult{}
}

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// +k8s:openapi-gen=true
type DashboardRangeMap struct {
	Type DashboardMappingType `json:"type"`
	// Range to match against and the result to apply when the value is within the range
	Options DashboardV2alpha1RangeMapOptions `json:"options"`
}

// NewDashboardRangeMap creates a new DashboardRangeMap object.
func NewDashboardRangeMap() *DashboardRangeMap {
	return &DashboardRangeMap{
		Type:    DashboardMappingTypeRange,
		Options: *NewDashboardV2alpha1RangeMapOptions(),
	}
}

// Maps regular expressions to replacement text and a color.
// For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// +k8s:openapi-gen=true
type DashboardRegexMap struct {
	Type DashboardMappingType `json:"type"`
	// Regular expression to match against and the result to apply when the value matches the regex
	Options DashboardV2alpha1RegexMapOptions `json:"options"`
}

// NewDashboardRegexMap creates a new DashboardRegexMap object.
func NewDashboardRegexMap() *DashboardRegexMap {
	return &DashboardRegexMap{
		Type:    DashboardMappingTypeRegex,
		Options: *NewDashboardV2alpha1RegexMapOptions(),
	}
}

// Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.
// See SpecialValueMatch to see the list of special values.
// For example, you can configure a special value mapping so that null values appear as N/A.
// +k8s:openapi-gen=true
type DashboardSpecialValueMap struct {
	Type    DashboardMappingType                    `json:"type"`
	Options DashboardV2alpha1SpecialValueMapOptions `json:"options"`
}

// NewDashboardSpecialValueMap creates a new DashboardSpecialValueMap object.
func NewDashboardSpecialValueMap() *DashboardSpecialValueMap {
	return &DashboardSpecialValueMap{
		Type:    DashboardMappingTypeSpecial,
		Options: *NewDashboardV2alpha1SpecialValueMapOptions(),
	}
}

// Special value types supported by the `SpecialValueMap`
// +k8s:openapi-gen=true
type DashboardSpecialValueMatch string

const (
	DashboardSpecialValueMatchTrue       DashboardSpecialValueMatch = "true"
	DashboardSpecialValueMatchFalse      DashboardSpecialValueMatch = "false"
	DashboardSpecialValueMatchNull       DashboardSpecialValueMatch = "null"
	DashboardSpecialValueMatchNaN        DashboardSpecialValueMatch = "nan"
	DashboardSpecialValueMatchNullAndNaN DashboardSpecialValueMatch = "null+nan"
	DashboardSpecialValueMatchEmpty      DashboardSpecialValueMatch = "empty"
)

// +k8s:openapi-gen=true
type DashboardThresholdsConfig struct {
	Mode  DashboardThresholdsMode `json:"mode"`
	Steps []DashboardThreshold    `json:"steps"`
}

// NewDashboardThresholdsConfig creates a new DashboardThresholdsConfig object.
func NewDashboardThresholdsConfig() *DashboardThresholdsConfig {
	return &DashboardThresholdsConfig{
		Steps: []DashboardThreshold{},
	}
}

// +k8s:openapi-gen=true
type DashboardThresholdsMode string

const (
	DashboardThresholdsModeAbsolute   DashboardThresholdsMode = "absolute"
	DashboardThresholdsModePercentage DashboardThresholdsMode = "percentage"
)

// +k8s:openapi-gen=true
type DashboardThreshold struct {
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

// NewDashboardThreshold creates a new DashboardThreshold object.
func NewDashboardThreshold() *DashboardThreshold {
	return &DashboardThreshold{}
}

// Map a field to a color.
// +k8s:openapi-gen=true
type DashboardFieldColor struct {
	// The main color scheme mode.
	Mode DashboardFieldColorModeId `json:"mode"`
	// The fixed color value for fixed or shades color modes.
	FixedColor *string `json:"fixedColor,omitempty"`
	// Some visualizations need to know how to assign a series color from by value color schemes.
	SeriesBy *DashboardFieldColorSeriesByMode `json:"seriesBy,omitempty"`
}

// NewDashboardFieldColor creates a new DashboardFieldColor object.
func NewDashboardFieldColor() *DashboardFieldColor {
	return &DashboardFieldColor{}
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
// +k8s:openapi-gen=true
type DashboardFieldColorModeId string

const (
	DashboardFieldColorModeIdThresholds           DashboardFieldColorModeId = "thresholds"
	DashboardFieldColorModeIdPaletteClassic       DashboardFieldColorModeId = "palette-classic"
	DashboardFieldColorModeIdPaletteClassicByName DashboardFieldColorModeId = "palette-classic-by-name"
	DashboardFieldColorModeIdContinuousGrYlRd     DashboardFieldColorModeId = "continuous-GrYlRd"
	DashboardFieldColorModeIdContinuousRdYlGr     DashboardFieldColorModeId = "continuous-RdYlGr"
	DashboardFieldColorModeIdContinuousBlYlRd     DashboardFieldColorModeId = "continuous-BlYlRd"
	DashboardFieldColorModeIdContinuousYlRd       DashboardFieldColorModeId = "continuous-YlRd"
	DashboardFieldColorModeIdContinuousBlPu       DashboardFieldColorModeId = "continuous-BlPu"
	DashboardFieldColorModeIdContinuousYlBl       DashboardFieldColorModeId = "continuous-YlBl"
	DashboardFieldColorModeIdContinuousBlues      DashboardFieldColorModeId = "continuous-blues"
	DashboardFieldColorModeIdContinuousReds       DashboardFieldColorModeId = "continuous-reds"
	DashboardFieldColorModeIdContinuousGreens     DashboardFieldColorModeId = "continuous-greens"
	DashboardFieldColorModeIdContinuousPurples    DashboardFieldColorModeId = "continuous-purples"
	DashboardFieldColorModeIdFixed                DashboardFieldColorModeId = "fixed"
	DashboardFieldColorModeIdShades               DashboardFieldColorModeId = "shades"
)

// Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
// +k8s:openapi-gen=true
type DashboardFieldColorSeriesByMode string

const (
	DashboardFieldColorSeriesByModeMin  DashboardFieldColorSeriesByMode = "min"
	DashboardFieldColorSeriesByModeMax  DashboardFieldColorSeriesByMode = "max"
	DashboardFieldColorSeriesByModeLast DashboardFieldColorSeriesByMode = "last"
)

// +k8s:openapi-gen=true
type DashboardDynamicConfigValue struct {
	Id    string      `json:"id"`
	Value interface{} `json:"value,omitempty"`
}

// NewDashboardDynamicConfigValue creates a new DashboardDynamicConfigValue object.
func NewDashboardDynamicConfigValue() *DashboardDynamicConfigValue {
	return &DashboardDynamicConfigValue{
		Id: "",
	}
}

// +k8s:openapi-gen=true
type DashboardLibraryPanelKind struct {
	Kind string                        `json:"kind"`
	Spec DashboardLibraryPanelKindSpec `json:"spec"`
}

// NewDashboardLibraryPanelKind creates a new DashboardLibraryPanelKind object.
func NewDashboardLibraryPanelKind() *DashboardLibraryPanelKind {
	return &DashboardLibraryPanelKind{
		Kind: "LibraryPanel",
		Spec: *NewDashboardLibraryPanelKindSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardLibraryPanelKindSpec struct {
	// Panel ID for the library panel in the dashboard
	Id float64 `json:"id"`
	// Title for the library panel in the dashboard
	Title        string                   `json:"title"`
	LibraryPanel DashboardLibraryPanelRef `json:"libraryPanel"`
}

// NewDashboardLibraryPanelKindSpec creates a new DashboardLibraryPanelKindSpec object.
func NewDashboardLibraryPanelKindSpec() *DashboardLibraryPanelKindSpec {
	return &DashboardLibraryPanelKindSpec{
		LibraryPanel: *NewDashboardLibraryPanelRef(),
	}
}

// A library panel is a reusable panel that you can use in any dashboard.
// When you make a change to a library panel, that change propagates to all instances of where the panel is used.
// Library panels streamline reuse of panels across multiple dashboards.
// +k8s:openapi-gen=true
type DashboardLibraryPanelRef struct {
	// Library panel name
	Name string `json:"name"`
	// Library panel uid
	Uid string `json:"uid"`
}

// NewDashboardLibraryPanelRef creates a new DashboardLibraryPanelRef object.
func NewDashboardLibraryPanelRef() *DashboardLibraryPanelRef {
	return &DashboardLibraryPanelRef{}
}

// +k8s:openapi-gen=true
type DashboardGridLayoutKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardGridLayoutSpec `json:"spec"`
}

// NewDashboardGridLayoutKind creates a new DashboardGridLayoutKind object.
func NewDashboardGridLayoutKind() *DashboardGridLayoutKind {
	return &DashboardGridLayoutKind{
		Kind: "GridLayout",
		Spec: *NewDashboardGridLayoutSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardGridLayoutSpec struct {
	Items []DashboardGridLayoutItemKind `json:"items"`
}

// NewDashboardGridLayoutSpec creates a new DashboardGridLayoutSpec object.
func NewDashboardGridLayoutSpec() *DashboardGridLayoutSpec {
	return &DashboardGridLayoutSpec{
		Items: []DashboardGridLayoutItemKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardGridLayoutItemKind struct {
	Kind string                      `json:"kind"`
	Spec DashboardGridLayoutItemSpec `json:"spec"`
}

// NewDashboardGridLayoutItemKind creates a new DashboardGridLayoutItemKind object.
func NewDashboardGridLayoutItemKind() *DashboardGridLayoutItemKind {
	return &DashboardGridLayoutItemKind{
		Kind: "GridLayoutItem",
		Spec: *NewDashboardGridLayoutItemSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardGridLayoutItemSpec struct {
	X      int64 `json:"x"`
	Y      int64 `json:"y"`
	Width  int64 `json:"width"`
	Height int64 `json:"height"`
	// reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
	Element DashboardElementReference `json:"element"`
	Repeat  *DashboardRepeatOptions   `json:"repeat,omitempty"`
}

// NewDashboardGridLayoutItemSpec creates a new DashboardGridLayoutItemSpec object.
func NewDashboardGridLayoutItemSpec() *DashboardGridLayoutItemSpec {
	return &DashboardGridLayoutItemSpec{
		Element: *NewDashboardElementReference(),
	}
}

// +k8s:openapi-gen=true
type DashboardElementReference struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// NewDashboardElementReference creates a new DashboardElementReference object.
func NewDashboardElementReference() *DashboardElementReference {
	return &DashboardElementReference{
		Kind: "ElementReference",
	}
}

// +k8s:openapi-gen=true
type DashboardRepeatOptions struct {
	Mode      string                           `json:"mode"`
	Value     string                           `json:"value"`
	Direction *DashboardRepeatOptionsDirection `json:"direction,omitempty"`
	MaxPerRow *int64                           `json:"maxPerRow,omitempty"`
}

// NewDashboardRepeatOptions creates a new DashboardRepeatOptions object.
func NewDashboardRepeatOptions() *DashboardRepeatOptions {
	return &DashboardRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// other repeat modes will be added in the future: label, frame
// +k8s:openapi-gen=true
const DashboardRepeatMode = "variable"

// +k8s:openapi-gen=true
type DashboardRowsLayoutKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardRowsLayoutSpec `json:"spec"`
}

// NewDashboardRowsLayoutKind creates a new DashboardRowsLayoutKind object.
func NewDashboardRowsLayoutKind() *DashboardRowsLayoutKind {
	return &DashboardRowsLayoutKind{
		Kind: "RowsLayout",
		Spec: *NewDashboardRowsLayoutSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardRowsLayoutSpec struct {
	Rows []DashboardRowsLayoutRowKind `json:"rows"`
}

// NewDashboardRowsLayoutSpec creates a new DashboardRowsLayoutSpec object.
func NewDashboardRowsLayoutSpec() *DashboardRowsLayoutSpec {
	return &DashboardRowsLayoutSpec{
		Rows: []DashboardRowsLayoutRowKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardRowsLayoutRowKind struct {
	Kind string                     `json:"kind"`
	Spec DashboardRowsLayoutRowSpec `json:"spec"`
}

// NewDashboardRowsLayoutRowKind creates a new DashboardRowsLayoutRowKind object.
func NewDashboardRowsLayoutRowKind() *DashboardRowsLayoutRowKind {
	return &DashboardRowsLayoutRowKind{
		Kind: "RowsLayoutRow",
		Spec: *NewDashboardRowsLayoutRowSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardRowsLayoutRowSpec struct {
	Title                *string                                                                     `json:"title,omitempty"`
	Collapse             *bool                                                                       `json:"collapse,omitempty"`
	HideHeader           *bool                                                                       `json:"hideHeader,omitempty"`
	FillScreen           *bool                                                                       `json:"fillScreen,omitempty"`
	ConditionalRendering *DashboardConditionalRenderingGroupKind                                     `json:"conditionalRendering,omitempty"`
	Repeat               *DashboardRowRepeatOptions                                                  `json:"repeat,omitempty"`
	Layout               DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind `json:"layout"`
}

// NewDashboardRowsLayoutRowSpec creates a new DashboardRowsLayoutRowSpec object.
func NewDashboardRowsLayoutRowSpec() *DashboardRowsLayoutRowSpec {
	return &DashboardRowsLayoutRowSpec{
		Layout: *NewDashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind(),
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupKind struct {
	Kind string                                 `json:"kind"`
	Spec DashboardConditionalRenderingGroupSpec `json:"spec"`
}

// NewDashboardConditionalRenderingGroupKind creates a new DashboardConditionalRenderingGroupKind object.
func NewDashboardConditionalRenderingGroupKind() *DashboardConditionalRenderingGroupKind {
	return &DashboardConditionalRenderingGroupKind{
		Kind: "ConditionalRenderingGroup",
		Spec: *NewDashboardConditionalRenderingGroupSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpec struct {
	Visibility DashboardConditionalRenderingGroupSpecVisibility                                                                 `json:"visibility"`
	Condition  DashboardConditionalRenderingGroupSpecCondition                                                                  `json:"condition"`
	Items      []DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind `json:"items"`
}

// NewDashboardConditionalRenderingGroupSpec creates a new DashboardConditionalRenderingGroupSpec object.
func NewDashboardConditionalRenderingGroupSpec() *DashboardConditionalRenderingGroupSpec {
	return &DashboardConditionalRenderingGroupSpec{
		Items: []DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableKind struct {
	Kind string                                    `json:"kind"`
	Spec DashboardConditionalRenderingVariableSpec `json:"spec"`
}

// NewDashboardConditionalRenderingVariableKind creates a new DashboardConditionalRenderingVariableKind object.
func NewDashboardConditionalRenderingVariableKind() *DashboardConditionalRenderingVariableKind {
	return &DashboardConditionalRenderingVariableKind{
		Kind: "ConditionalRenderingVariable",
		Spec: *NewDashboardConditionalRenderingVariableSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableSpec struct {
	Variable string                                            `json:"variable"`
	Operator DashboardConditionalRenderingVariableSpecOperator `json:"operator"`
	Value    string                                            `json:"value"`
}

// NewDashboardConditionalRenderingVariableSpec creates a new DashboardConditionalRenderingVariableSpec object.
func NewDashboardConditionalRenderingVariableSpec() *DashboardConditionalRenderingVariableSpec {
	return &DashboardConditionalRenderingVariableSpec{}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingDataKind struct {
	Kind string                                `json:"kind"`
	Spec DashboardConditionalRenderingDataSpec `json:"spec"`
}

// NewDashboardConditionalRenderingDataKind creates a new DashboardConditionalRenderingDataKind object.
func NewDashboardConditionalRenderingDataKind() *DashboardConditionalRenderingDataKind {
	return &DashboardConditionalRenderingDataKind{
		Kind: "ConditionalRenderingData",
		Spec: *NewDashboardConditionalRenderingDataSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingDataSpec struct {
	Value bool `json:"value"`
}

// NewDashboardConditionalRenderingDataSpec creates a new DashboardConditionalRenderingDataSpec object.
func NewDashboardConditionalRenderingDataSpec() *DashboardConditionalRenderingDataSpec {
	return &DashboardConditionalRenderingDataSpec{}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingTimeRangeSizeKind struct {
	Kind string                                         `json:"kind"`
	Spec DashboardConditionalRenderingTimeRangeSizeSpec `json:"spec"`
}

// NewDashboardConditionalRenderingTimeRangeSizeKind creates a new DashboardConditionalRenderingTimeRangeSizeKind object.
func NewDashboardConditionalRenderingTimeRangeSizeKind() *DashboardConditionalRenderingTimeRangeSizeKind {
	return &DashboardConditionalRenderingTimeRangeSizeKind{
		Kind: "ConditionalRenderingTimeRangeSize",
		Spec: *NewDashboardConditionalRenderingTimeRangeSizeSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingTimeRangeSizeSpec struct {
	Value string `json:"value"`
}

// NewDashboardConditionalRenderingTimeRangeSizeSpec creates a new DashboardConditionalRenderingTimeRangeSizeSpec object.
func NewDashboardConditionalRenderingTimeRangeSizeSpec() *DashboardConditionalRenderingTimeRangeSizeSpec {
	return &DashboardConditionalRenderingTimeRangeSizeSpec{}
}

// +k8s:openapi-gen=true
type DashboardRowRepeatOptions struct {
	Mode  string `json:"mode"`
	Value string `json:"value"`
}

// NewDashboardRowRepeatOptions creates a new DashboardRowRepeatOptions object.
func NewDashboardRowRepeatOptions() *DashboardRowRepeatOptions {
	return &DashboardRowRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutKind struct {
	Kind string                      `json:"kind"`
	Spec DashboardAutoGridLayoutSpec `json:"spec"`
}

// NewDashboardAutoGridLayoutKind creates a new DashboardAutoGridLayoutKind object.
func NewDashboardAutoGridLayoutKind() *DashboardAutoGridLayoutKind {
	return &DashboardAutoGridLayoutKind{
		Kind: "AutoGridLayout",
		Spec: *NewDashboardAutoGridLayoutSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpec struct {
	MaxColumnCount  *float64                                   `json:"maxColumnCount,omitempty"`
	ColumnWidthMode DashboardAutoGridLayoutSpecColumnWidthMode `json:"columnWidthMode"`
	ColumnWidth     *float64                                   `json:"columnWidth,omitempty"`
	RowHeightMode   DashboardAutoGridLayoutSpecRowHeightMode   `json:"rowHeightMode"`
	RowHeight       *float64                                   `json:"rowHeight,omitempty"`
	FillScreen      *bool                                      `json:"fillScreen,omitempty"`
	Items           []DashboardAutoGridLayoutItemKind          `json:"items"`
}

// NewDashboardAutoGridLayoutSpec creates a new DashboardAutoGridLayoutSpec object.
func NewDashboardAutoGridLayoutSpec() *DashboardAutoGridLayoutSpec {
	return &DashboardAutoGridLayoutSpec{
		MaxColumnCount: (func(input float64) *float64 { return &input })(3),
		FillScreen:     (func(input bool) *bool { return &input })(false),
		Items:          []DashboardAutoGridLayoutItemKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutItemKind struct {
	Kind string                          `json:"kind"`
	Spec DashboardAutoGridLayoutItemSpec `json:"spec"`
}

// NewDashboardAutoGridLayoutItemKind creates a new DashboardAutoGridLayoutItemKind object.
func NewDashboardAutoGridLayoutItemKind() *DashboardAutoGridLayoutItemKind {
	return &DashboardAutoGridLayoutItemKind{
		Kind: "AutoGridLayoutItem",
		Spec: *NewDashboardAutoGridLayoutItemSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutItemSpec struct {
	Element              DashboardElementReference               `json:"element"`
	Repeat               *DashboardAutoGridRepeatOptions         `json:"repeat,omitempty"`
	ConditionalRendering *DashboardConditionalRenderingGroupKind `json:"conditionalRendering,omitempty"`
}

// NewDashboardAutoGridLayoutItemSpec creates a new DashboardAutoGridLayoutItemSpec object.
func NewDashboardAutoGridLayoutItemSpec() *DashboardAutoGridLayoutItemSpec {
	return &DashboardAutoGridLayoutItemSpec{
		Element: *NewDashboardElementReference(),
	}
}

// +k8s:openapi-gen=true
type DashboardAutoGridRepeatOptions struct {
	Mode  string `json:"mode"`
	Value string `json:"value"`
}

// NewDashboardAutoGridRepeatOptions creates a new DashboardAutoGridRepeatOptions object.
func NewDashboardAutoGridRepeatOptions() *DashboardAutoGridRepeatOptions {
	return &DashboardAutoGridRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// +k8s:openapi-gen=true
type DashboardTabsLayoutKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardTabsLayoutSpec `json:"spec"`
}

// NewDashboardTabsLayoutKind creates a new DashboardTabsLayoutKind object.
func NewDashboardTabsLayoutKind() *DashboardTabsLayoutKind {
	return &DashboardTabsLayoutKind{
		Kind: "TabsLayout",
		Spec: *NewDashboardTabsLayoutSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardTabsLayoutSpec struct {
	Tabs []DashboardTabsLayoutTabKind `json:"tabs"`
}

// NewDashboardTabsLayoutSpec creates a new DashboardTabsLayoutSpec object.
func NewDashboardTabsLayoutSpec() *DashboardTabsLayoutSpec {
	return &DashboardTabsLayoutSpec{
		Tabs: []DashboardTabsLayoutTabKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardTabsLayoutTabKind struct {
	Kind string                     `json:"kind"`
	Spec DashboardTabsLayoutTabSpec `json:"spec"`
}

// NewDashboardTabsLayoutTabKind creates a new DashboardTabsLayoutTabKind object.
func NewDashboardTabsLayoutTabKind() *DashboardTabsLayoutTabKind {
	return &DashboardTabsLayoutTabKind{
		Kind: "TabsLayoutTab",
		Spec: *NewDashboardTabsLayoutTabSpec(),
	}
}

// +k8s:openapi-gen=true
type DashboardTabsLayoutTabSpec struct {
	Title                *string                                                                     `json:"title,omitempty"`
	Layout               DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind `json:"layout"`
	ConditionalRendering *DashboardConditionalRenderingGroupKind                                     `json:"conditionalRendering,omitempty"`
	Repeat               *DashboardTabRepeatOptions                                                  `json:"repeat,omitempty"`
}

// NewDashboardTabsLayoutTabSpec creates a new DashboardTabsLayoutTabSpec object.
func NewDashboardTabsLayoutTabSpec() *DashboardTabsLayoutTabSpec {
	return &DashboardTabsLayoutTabSpec{
		Layout: *NewDashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind(),
	}
}

// +k8s:openapi-gen=true
type DashboardTabRepeatOptions struct {
	Mode  string `json:"mode"`
	Value string `json:"value"`
}

// NewDashboardTabRepeatOptions creates a new DashboardTabRepeatOptions object.
func NewDashboardTabRepeatOptions() *DashboardTabRepeatOptions {
	return &DashboardTabRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// Links with references to other dashboards or external resources
// +k8s:openapi-gen=true
type DashboardDashboardLink struct {
	// Title to display with the link
	Title string `json:"title"`
	// Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
	// FIXME: The type is generated as `type: DashboardLinkType | dashboardLinkType.Link;` but it should be `type: DashboardLinkType`
	Type DashboardDashboardLinkType `json:"type"`
	// Icon name to be displayed with the link
	Icon string `json:"icon"`
	// Tooltip to display when the user hovers their mouse over it
	Tooltip string `json:"tooltip"`
	// Link URL. Only required/valid if the type is link
	Url *string `json:"url,omitempty"`
	// List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards
	Tags []string `json:"tags"`
	// If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards
	AsDropdown bool `json:"asDropdown"`
	// If true, the link will be opened in a new tab
	TargetBlank bool `json:"targetBlank"`
	// If true, includes current template variables values in the link as query params
	IncludeVars bool `json:"includeVars"`
	// If true, includes current time range in the link as query params
	KeepTime bool `json:"keepTime"`
}

// NewDashboardDashboardLink creates a new DashboardDashboardLink object.
func NewDashboardDashboardLink() *DashboardDashboardLink {
	return &DashboardDashboardLink{
		Tags:        []string{},
		AsDropdown:  false,
		TargetBlank: false,
		IncludeVars: false,
		KeepTime:    false,
	}
}

// Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
// +k8s:openapi-gen=true
type DashboardDashboardLinkType string

const (
	DashboardDashboardLinkTypeLink       DashboardDashboardLinkType = "link"
	DashboardDashboardLinkTypeDashboards DashboardDashboardLinkType = "dashboards"
)

// Time configuration
// It defines the default time config for the time picker, the refresh picker for the specific dashboard.
// +k8s:openapi-gen=true
type DashboardTimeSettingsSpec struct {
	// Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc".
	Timezone *string `json:"timezone,omitempty"`
	// Start time range for dashboard.
	// Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
	From string `json:"from"`
	// End time range for dashboard.
	// Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".
	To string `json:"to"`
	// Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".
	// v1: refresh
	AutoRefresh string `json:"autoRefresh"`
	// Interval options available in the refresh picker dropdown.
	// v1: timepicker.refresh_intervals
	AutoRefreshIntervals []string `json:"autoRefreshIntervals"`
	// Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.
	// v1: timepicker.quick_ranges , not exposed in the UI
	QuickRanges []DashboardTimeRangeOption `json:"quickRanges,omitempty"`
	// Whether timepicker is visible or not.
	// v1: timepicker.hidden
	HideTimepicker bool `json:"hideTimepicker"`
	// Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
	WeekStart *DashboardTimeSettingsSpecWeekStart `json:"weekStart,omitempty"`
	// The month that the fiscal year starts on. 0 = January, 11 = December
	FiscalYearStartMonth int64 `json:"fiscalYearStartMonth"`
	// Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
	// v1: timepicker.nowDelay
	NowDelay *string `json:"nowDelay,omitempty"`
}

// NewDashboardTimeSettingsSpec creates a new DashboardTimeSettingsSpec object.
func NewDashboardTimeSettingsSpec() *DashboardTimeSettingsSpec {
	return &DashboardTimeSettingsSpec{
		Timezone:             (func(input string) *string { return &input })("browser"),
		From:                 "now-6h",
		To:                   "now",
		AutoRefresh:          "",
		AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
		HideTimepicker:       false,
		FiscalYearStartMonth: 0,
	}
}

// +k8s:openapi-gen=true
type DashboardTimeRangeOption struct {
	Display string `json:"display"`
	From    string `json:"from"`
	To      string `json:"to"`
}

// NewDashboardTimeRangeOption creates a new DashboardTimeRangeOption object.
func NewDashboardTimeRangeOption() *DashboardTimeRangeOption {
	return &DashboardTimeRangeOption{
		Display: "Last 6 hours",
		From:    "now-6h",
		To:      "now",
	}
}

// +k8s:openapi-gen=true
type DashboardVariableKind = DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind

// NewDashboardVariableKind creates a new DashboardVariableKind object.
func NewDashboardVariableKind() *DashboardVariableKind {
	return NewDashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind()
}

// Query variable kind
// +k8s:openapi-gen=true
type DashboardQueryVariableKind struct {
	Kind string                     `json:"kind"`
	Spec DashboardQueryVariableSpec `json:"spec"`
}

// NewDashboardQueryVariableKind creates a new DashboardQueryVariableKind object.
func NewDashboardQueryVariableKind() *DashboardQueryVariableKind {
	return &DashboardQueryVariableKind{
		Kind: "QueryVariable",
		Spec: *NewDashboardQueryVariableSpec(),
	}
}

// Query variable specification
// +k8s:openapi-gen=true
type DashboardQueryVariableSpec struct {
	Name               string                                        `json:"name"`
	Current            DashboardVariableOption                       `json:"current"`
	Label              *string                                       `json:"label,omitempty"`
	Hide               DashboardVariableHide                         `json:"hide"`
	Refresh            DashboardVariableRefresh                      `json:"refresh"`
	SkipUrlSync        bool                                          `json:"skipUrlSync"`
	Description        *string                                       `json:"description,omitempty"`
	Datasource         *DashboardDataSourceRef                       `json:"datasource,omitempty"`
	Query              DashboardDataQueryKind                        `json:"query"`
	Regex              string                                        `json:"regex"`
	Sort               DashboardVariableSort                         `json:"sort"`
	Definition         *string                                       `json:"definition,omitempty"`
	Options            []DashboardVariableOption                     `json:"options"`
	Multi              bool                                          `json:"multi"`
	IncludeAll         bool                                          `json:"includeAll"`
	AllValue           *string                                       `json:"allValue,omitempty"`
	Placeholder        *string                                       `json:"placeholder,omitempty"`
	AllowCustomValue   bool                                          `json:"allowCustomValue"`
	StaticOptions      []DashboardVariableOption                     `json:"staticOptions,omitempty"`
	StaticOptionsOrder *DashboardQueryVariableSpecStaticOptionsOrder `json:"staticOptionsOrder,omitempty"`
}

// NewDashboardQueryVariableSpec creates a new DashboardQueryVariableSpec object.
func NewDashboardQueryVariableSpec() *DashboardQueryVariableSpec {
	return &DashboardQueryVariableSpec{
		Name: "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Hide:             DashboardVariableHideDontHide,
		Refresh:          DashboardVariableRefreshNever,
		SkipUrlSync:      false,
		Query:            *NewDashboardDataQueryKind(),
		Regex:            "",
		Options:          []DashboardVariableOption{},
		Multi:            false,
		IncludeAll:       false,
		AllowCustomValue: true,
	}
}

// Variable option specification
// +k8s:openapi-gen=true
type DashboardVariableOption struct {
	// Whether the option is selected or not
	Selected *bool `json:"selected,omitempty"`
	// Text to be displayed for the option
	Text DashboardStringOrArrayOfString `json:"text"`
	// Value of the option
	Value DashboardStringOrArrayOfString `json:"value"`
}

// NewDashboardVariableOption creates a new DashboardVariableOption object.
func NewDashboardVariableOption() *DashboardVariableOption {
	return &DashboardVariableOption{
		Text:  *NewDashboardStringOrArrayOfString(),
		Value: *NewDashboardStringOrArrayOfString(),
	}
}

// Determine if the variable shows on dashboard
// Accepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing).
// +k8s:openapi-gen=true
type DashboardVariableHide string

const (
	DashboardVariableHideDontHide     DashboardVariableHide = "dontHide"
	DashboardVariableHideHideLabel    DashboardVariableHide = "hideLabel"
	DashboardVariableHideHideVariable DashboardVariableHide = "hideVariable"
)

// Options to config when to refresh a variable
// `never`: Never refresh the variable
// `onDashboardLoad`: Queries the data source every time the dashboard loads.
// `onTimeRangeChanged`: Queries the data source when the dashboard time range changes.
// +k8s:openapi-gen=true
type DashboardVariableRefresh string

const (
	DashboardVariableRefreshNever              DashboardVariableRefresh = "never"
	DashboardVariableRefreshOnDashboardLoad    DashboardVariableRefresh = "onDashboardLoad"
	DashboardVariableRefreshOnTimeRangeChanged DashboardVariableRefresh = "onTimeRangeChanged"
)

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
// +k8s:openapi-gen=true
type DashboardVariableSort string

const (
	DashboardVariableSortDisabled                        DashboardVariableSort = "disabled"
	DashboardVariableSortAlphabeticalAsc                 DashboardVariableSort = "alphabeticalAsc"
	DashboardVariableSortAlphabeticalDesc                DashboardVariableSort = "alphabeticalDesc"
	DashboardVariableSortNumericalAsc                    DashboardVariableSort = "numericalAsc"
	DashboardVariableSortNumericalDesc                   DashboardVariableSort = "numericalDesc"
	DashboardVariableSortAlphabeticalCaseInsensitiveAsc  DashboardVariableSort = "alphabeticalCaseInsensitiveAsc"
	DashboardVariableSortAlphabeticalCaseInsensitiveDesc DashboardVariableSort = "alphabeticalCaseInsensitiveDesc"
	DashboardVariableSortNaturalAsc                      DashboardVariableSort = "naturalAsc"
	DashboardVariableSortNaturalDesc                     DashboardVariableSort = "naturalDesc"
)

// Text variable kind
// +k8s:openapi-gen=true
type DashboardTextVariableKind struct {
	Kind string                    `json:"kind"`
	Spec DashboardTextVariableSpec `json:"spec"`
}

// NewDashboardTextVariableKind creates a new DashboardTextVariableKind object.
func NewDashboardTextVariableKind() *DashboardTextVariableKind {
	return &DashboardTextVariableKind{
		Kind: "TextVariable",
		Spec: *NewDashboardTextVariableSpec(),
	}
}

// Text variable specification
// +k8s:openapi-gen=true
type DashboardTextVariableSpec struct {
	Name        string                  `json:"name"`
	Current     DashboardVariableOption `json:"current"`
	Query       string                  `json:"query"`
	Label       *string                 `json:"label,omitempty"`
	Hide        DashboardVariableHide   `json:"hide"`
	SkipUrlSync bool                    `json:"skipUrlSync"`
	Description *string                 `json:"description,omitempty"`
}

// NewDashboardTextVariableSpec creates a new DashboardTextVariableSpec object.
func NewDashboardTextVariableSpec() *DashboardTextVariableSpec {
	return &DashboardTextVariableSpec{
		Name: "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Query:       "",
		Hide:        DashboardVariableHideDontHide,
		SkipUrlSync: false,
	}
}

// Constant variable kind
// +k8s:openapi-gen=true
type DashboardConstantVariableKind struct {
	Kind string                        `json:"kind"`
	Spec DashboardConstantVariableSpec `json:"spec"`
}

// NewDashboardConstantVariableKind creates a new DashboardConstantVariableKind object.
func NewDashboardConstantVariableKind() *DashboardConstantVariableKind {
	return &DashboardConstantVariableKind{
		Kind: "ConstantVariable",
		Spec: *NewDashboardConstantVariableSpec(),
	}
}

// Constant variable specification
// +k8s:openapi-gen=true
type DashboardConstantVariableSpec struct {
	Name        string                  `json:"name"`
	Query       string                  `json:"query"`
	Current     DashboardVariableOption `json:"current"`
	Label       *string                 `json:"label,omitempty"`
	Hide        DashboardVariableHide   `json:"hide"`
	SkipUrlSync bool                    `json:"skipUrlSync"`
	Description *string                 `json:"description,omitempty"`
}

// NewDashboardConstantVariableSpec creates a new DashboardConstantVariableSpec object.
func NewDashboardConstantVariableSpec() *DashboardConstantVariableSpec {
	return &DashboardConstantVariableSpec{
		Name:  "",
		Query: "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Hide:        DashboardVariableHideDontHide,
		SkipUrlSync: false,
	}
}

// Datasource variable kind
// +k8s:openapi-gen=true
type DashboardDatasourceVariableKind struct {
	Kind string                          `json:"kind"`
	Spec DashboardDatasourceVariableSpec `json:"spec"`
}

// NewDashboardDatasourceVariableKind creates a new DashboardDatasourceVariableKind object.
func NewDashboardDatasourceVariableKind() *DashboardDatasourceVariableKind {
	return &DashboardDatasourceVariableKind{
		Kind: "DatasourceVariable",
		Spec: *NewDashboardDatasourceVariableSpec(),
	}
}

// Datasource variable specification
// +k8s:openapi-gen=true
type DashboardDatasourceVariableSpec struct {
	Name             string                    `json:"name"`
	PluginId         string                    `json:"pluginId"`
	Refresh          DashboardVariableRefresh  `json:"refresh"`
	Regex            string                    `json:"regex"`
	Current          DashboardVariableOption   `json:"current"`
	Options          []DashboardVariableOption `json:"options"`
	Multi            bool                      `json:"multi"`
	IncludeAll       bool                      `json:"includeAll"`
	AllValue         *string                   `json:"allValue,omitempty"`
	Label            *string                   `json:"label,omitempty"`
	Hide             DashboardVariableHide     `json:"hide"`
	SkipUrlSync      bool                      `json:"skipUrlSync"`
	Description      *string                   `json:"description,omitempty"`
	AllowCustomValue bool                      `json:"allowCustomValue"`
}

// NewDashboardDatasourceVariableSpec creates a new DashboardDatasourceVariableSpec object.
func NewDashboardDatasourceVariableSpec() *DashboardDatasourceVariableSpec {
	return &DashboardDatasourceVariableSpec{
		Name:     "",
		PluginId: "",
		Refresh:  DashboardVariableRefreshNever,
		Regex:    "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Options:          []DashboardVariableOption{},
		Multi:            false,
		IncludeAll:       false,
		Hide:             DashboardVariableHideDontHide,
		SkipUrlSync:      false,
		AllowCustomValue: true,
	}
}

// Interval variable kind
// +k8s:openapi-gen=true
type DashboardIntervalVariableKind struct {
	Kind string                        `json:"kind"`
	Spec DashboardIntervalVariableSpec `json:"spec"`
}

// NewDashboardIntervalVariableKind creates a new DashboardIntervalVariableKind object.
func NewDashboardIntervalVariableKind() *DashboardIntervalVariableKind {
	return &DashboardIntervalVariableKind{
		Kind: "IntervalVariable",
		Spec: *NewDashboardIntervalVariableSpec(),
	}
}

// Interval variable specification
// +k8s:openapi-gen=true
type DashboardIntervalVariableSpec struct {
	Name        string                    `json:"name"`
	Query       string                    `json:"query"`
	Current     DashboardVariableOption   `json:"current"`
	Options     []DashboardVariableOption `json:"options"`
	Auto        bool                      `json:"auto"`
	AutoMin     string                    `json:"auto_min"`
	AutoCount   int64                     `json:"auto_count"`
	Refresh     DashboardVariableRefresh  `json:"refresh"`
	Label       *string                   `json:"label,omitempty"`
	Hide        DashboardVariableHide     `json:"hide"`
	SkipUrlSync bool                      `json:"skipUrlSync"`
	Description *string                   `json:"description,omitempty"`
}

// NewDashboardIntervalVariableSpec creates a new DashboardIntervalVariableSpec object.
func NewDashboardIntervalVariableSpec() *DashboardIntervalVariableSpec {
	return &DashboardIntervalVariableSpec{
		Name:  "",
		Query: "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Options:     []DashboardVariableOption{},
		Auto:        false,
		AutoMin:     "",
		AutoCount:   0,
		Refresh:     DashboardVariableRefreshNever,
		Hide:        DashboardVariableHideDontHide,
		SkipUrlSync: false,
	}
}

// Custom variable kind
// +k8s:openapi-gen=true
type DashboardCustomVariableKind struct {
	Kind string                      `json:"kind"`
	Spec DashboardCustomVariableSpec `json:"spec"`
}

// NewDashboardCustomVariableKind creates a new DashboardCustomVariableKind object.
func NewDashboardCustomVariableKind() *DashboardCustomVariableKind {
	return &DashboardCustomVariableKind{
		Kind: "CustomVariable",
		Spec: *NewDashboardCustomVariableSpec(),
	}
}

// Custom variable specification
// +k8s:openapi-gen=true
type DashboardCustomVariableSpec struct {
	Name             string                    `json:"name"`
	Query            string                    `json:"query"`
	Current          DashboardVariableOption   `json:"current"`
	Options          []DashboardVariableOption `json:"options"`
	Multi            bool                      `json:"multi"`
	IncludeAll       bool                      `json:"includeAll"`
	AllValue         *string                   `json:"allValue,omitempty"`
	Label            *string                   `json:"label,omitempty"`
	Hide             DashboardVariableHide     `json:"hide"`
	SkipUrlSync      bool                      `json:"skipUrlSync"`
	Description      *string                   `json:"description,omitempty"`
	AllowCustomValue bool                      `json:"allowCustomValue"`
}

// NewDashboardCustomVariableSpec creates a new DashboardCustomVariableSpec object.
func NewDashboardCustomVariableSpec() *DashboardCustomVariableSpec {
	return &DashboardCustomVariableSpec{
		Name:             "",
		Query:            "",
		Current:          *NewDashboardVariableOption(),
		Options:          []DashboardVariableOption{},
		Multi:            false,
		IncludeAll:       false,
		Hide:             DashboardVariableHideDontHide,
		SkipUrlSync:      false,
		AllowCustomValue: true,
	}
}

// Group variable kind
// +k8s:openapi-gen=true
type DashboardGroupByVariableKind struct {
	Kind string                       `json:"kind"`
	Spec DashboardGroupByVariableSpec `json:"spec"`
}

// NewDashboardGroupByVariableKind creates a new DashboardGroupByVariableKind object.
func NewDashboardGroupByVariableKind() *DashboardGroupByVariableKind {
	return &DashboardGroupByVariableKind{
		Kind: "GroupByVariable",
		Spec: *NewDashboardGroupByVariableSpec(),
	}
}

// GroupBy variable specification
// +k8s:openapi-gen=true
type DashboardGroupByVariableSpec struct {
	Name         string                    `json:"name"`
	Datasource   *DashboardDataSourceRef   `json:"datasource,omitempty"`
	DefaultValue *DashboardVariableOption  `json:"defaultValue,omitempty"`
	Current      DashboardVariableOption   `json:"current"`
	Options      []DashboardVariableOption `json:"options"`
	Multi        bool                      `json:"multi"`
	Label        *string                   `json:"label,omitempty"`
	Hide         DashboardVariableHide     `json:"hide"`
	SkipUrlSync  bool                      `json:"skipUrlSync"`
	Description  *string                   `json:"description,omitempty"`
}

// NewDashboardGroupByVariableSpec creates a new DashboardGroupByVariableSpec object.
func NewDashboardGroupByVariableSpec() *DashboardGroupByVariableSpec {
	return &DashboardGroupByVariableSpec{
		Name: "",
		Current: DashboardVariableOption{
			Text: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
			Value: DashboardStringOrArrayOfString{
				String: (func(input string) *string { return &input })(""),
			},
		},
		Options:     []DashboardVariableOption{},
		Multi:       false,
		Hide:        DashboardVariableHideDontHide,
		SkipUrlSync: false,
	}
}

// Adhoc variable kind
// +k8s:openapi-gen=true
type DashboardAdhocVariableKind struct {
	Kind string                     `json:"kind"`
	Spec DashboardAdhocVariableSpec `json:"spec"`
}

// NewDashboardAdhocVariableKind creates a new DashboardAdhocVariableKind object.
func NewDashboardAdhocVariableKind() *DashboardAdhocVariableKind {
	return &DashboardAdhocVariableKind{
		Kind: "AdhocVariable",
		Spec: *NewDashboardAdhocVariableSpec(),
	}
}

// Adhoc variable specification
// +k8s:openapi-gen=true
type DashboardAdhocVariableSpec struct {
	Name             string                           `json:"name"`
	Datasource       *DashboardDataSourceRef          `json:"datasource,omitempty"`
	BaseFilters      []DashboardAdHocFilterWithLabels `json:"baseFilters"`
	Filters          []DashboardAdHocFilterWithLabels `json:"filters"`
	DefaultKeys      []DashboardMetricFindValue       `json:"defaultKeys"`
	Label            *string                          `json:"label,omitempty"`
	Hide             DashboardVariableHide            `json:"hide"`
	SkipUrlSync      bool                             `json:"skipUrlSync"`
	Description      *string                          `json:"description,omitempty"`
	AllowCustomValue bool                             `json:"allowCustomValue"`
}

// NewDashboardAdhocVariableSpec creates a new DashboardAdhocVariableSpec object.
func NewDashboardAdhocVariableSpec() *DashboardAdhocVariableSpec {
	return &DashboardAdhocVariableSpec{
		Name:             "",
		BaseFilters:      []DashboardAdHocFilterWithLabels{},
		Filters:          []DashboardAdHocFilterWithLabels{},
		DefaultKeys:      []DashboardMetricFindValue{},
		Hide:             DashboardVariableHideDontHide,
		SkipUrlSync:      false,
		AllowCustomValue: true,
	}
}

// Define the AdHocFilterWithLabels type
// +k8s:openapi-gen=true
type DashboardAdHocFilterWithLabels struct {
	Key         string   `json:"key"`
	Operator    string   `json:"operator"`
	Value       string   `json:"value"`
	Values      []string `json:"values,omitempty"`
	KeyLabel    *string  `json:"keyLabel,omitempty"`
	ValueLabels []string `json:"valueLabels,omitempty"`
	ForceEdit   *bool    `json:"forceEdit,omitempty"`
	Origin      string   `json:"origin,omitempty"`
	// @deprecated
	Condition *string `json:"condition,omitempty"`
}

// NewDashboardAdHocFilterWithLabels creates a new DashboardAdHocFilterWithLabels object.
func NewDashboardAdHocFilterWithLabels() *DashboardAdHocFilterWithLabels {
	return &DashboardAdHocFilterWithLabels{
		Origin: DashboardFilterOrigin,
	}
}

// Determine the origin of the adhoc variable filter
// +k8s:openapi-gen=true
const DashboardFilterOrigin = "dashboard"

// Define the MetricFindValue type
// +k8s:openapi-gen=true
type DashboardMetricFindValue struct {
	Text       string                    `json:"text"`
	Value      *DashboardStringOrFloat64 `json:"value,omitempty"`
	Group      *string                   `json:"group,omitempty"`
	Expandable *bool                     `json:"expandable,omitempty"`
}

// NewDashboardMetricFindValue creates a new DashboardMetricFindValue object.
func NewDashboardMetricFindValue() *DashboardMetricFindValue {
	return &DashboardMetricFindValue{}
}

// +k8s:openapi-gen=true
type DashboardSpec struct {
	Annotations []DashboardAnnotationQueryKind `json:"annotations"`
	// Configuration of dashboard cursor sync behavior.
	// "Off" for no shared crosshair or tooltip (default).
	// "Crosshair" for shared crosshair.
	// "Tooltip" for shared crosshair AND shared tooltip.
	CursorSync DashboardDashboardCursorSync `json:"cursorSync"`
	// Description of dashboard.
	Description *string `json:"description,omitempty"`
	// Whether a dashboard is editable or not.
	Editable *bool                                                                       `json:"editable,omitempty"`
	Elements map[string]DashboardElement                                                 `json:"elements"`
	Layout   DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind `json:"layout"`
	// Links with references to other dashboards or external websites.
	Links []DashboardDashboardLink `json:"links"`
	// When set to true, the dashboard will redraw panels at an interval matching the pixel width.
	// This will keep data "moving left" regardless of the query refresh rate. This setting helps
	// avoid dashboards presenting stale live data.
	LiveNow *bool `json:"liveNow,omitempty"`
	// When set to true, the dashboard will load all panels in the dashboard when it's loaded.
	Preload bool `json:"preload"`
	// Plugins only. The version of the dashboard installed together with the plugin.
	// This is used to determine if the dashboard should be updated when the plugin is updated.
	Revision *uint16 `json:"revision,omitempty"`
	// Tags associated with dashboard.
	Tags         []string                  `json:"tags"`
	TimeSettings DashboardTimeSettingsSpec `json:"timeSettings"`
	// Title of dashboard.
	Title string `json:"title"`
	// Configured template variables.
	Variables []DashboardVariableKind `json:"variables"`
}

// NewDashboardSpec creates a new DashboardSpec object.
func NewDashboardSpec() *DashboardSpec {
	return &DashboardSpec{
		Annotations:  []DashboardAnnotationQueryKind{},
		CursorSync:   DashboardDashboardCursorSyncOff,
		Editable:     (func(input bool) *bool { return &input })(true),
		Elements:     map[string]DashboardElement{},
		Layout:       *NewDashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind(),
		Links:        []DashboardDashboardLink{},
		Preload:      false,
		Tags:         []string{},
		TimeSettings: *NewDashboardTimeSettingsSpec(),
		Variables:    []DashboardVariableKind{},
	}
}

// +k8s:openapi-gen=true
type DashboardV2alpha1FieldConfigSourceOverrides struct {
	Matcher    DashboardMatcherConfig        `json:"matcher"`
	Properties []DashboardDynamicConfigValue `json:"properties"`
}

// NewDashboardV2alpha1FieldConfigSourceOverrides creates a new DashboardV2alpha1FieldConfigSourceOverrides object.
func NewDashboardV2alpha1FieldConfigSourceOverrides() *DashboardV2alpha1FieldConfigSourceOverrides {
	return &DashboardV2alpha1FieldConfigSourceOverrides{
		Matcher:    *NewDashboardMatcherConfig(),
		Properties: []DashboardDynamicConfigValue{},
	}
}

// +k8s:openapi-gen=true
type DashboardV2alpha1RangeMapOptions struct {
	// Min value of the range. It can be null which means -Infinity
	From *float64 `json:"from"`
	// Max value of the range. It can be null which means +Infinity
	To *float64 `json:"to"`
	// Config to apply when the value is within the range
	Result DashboardValueMappingResult `json:"result"`
}

// NewDashboardV2alpha1RangeMapOptions creates a new DashboardV2alpha1RangeMapOptions object.
func NewDashboardV2alpha1RangeMapOptions() *DashboardV2alpha1RangeMapOptions {
	return &DashboardV2alpha1RangeMapOptions{
		Result: *NewDashboardValueMappingResult(),
	}
}

// +k8s:openapi-gen=true
type DashboardV2alpha1RegexMapOptions struct {
	// Regular expression to match against
	Pattern string `json:"pattern"`
	// Config to apply when the value matches the regex
	Result DashboardValueMappingResult `json:"result"`
}

// NewDashboardV2alpha1RegexMapOptions creates a new DashboardV2alpha1RegexMapOptions object.
func NewDashboardV2alpha1RegexMapOptions() *DashboardV2alpha1RegexMapOptions {
	return &DashboardV2alpha1RegexMapOptions{
		Result: *NewDashboardValueMappingResult(),
	}
}

// +k8s:openapi-gen=true
type DashboardV2alpha1SpecialValueMapOptions struct {
	// Special value to match against
	Match DashboardSpecialValueMatch `json:"match"`
	// Config to apply when the value matches the special value
	Result DashboardValueMappingResult `json:"result"`
}

// NewDashboardV2alpha1SpecialValueMapOptions creates a new DashboardV2alpha1SpecialValueMapOptions object.
func NewDashboardV2alpha1SpecialValueMapOptions() *DashboardV2alpha1SpecialValueMapOptions {
	return &DashboardV2alpha1SpecialValueMapOptions{
		Result: *NewDashboardValueMappingResult(),
	}
}

// +k8s:openapi-gen=true
type DashboardRepeatOptionsDirection string

const (
	DashboardRepeatOptionsDirectionH DashboardRepeatOptionsDirection = "h"
	DashboardRepeatOptionsDirectionV DashboardRepeatOptionsDirection = "v"
)

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpecVisibility string

const (
	DashboardConditionalRenderingGroupSpecVisibilityShow DashboardConditionalRenderingGroupSpecVisibility = "show"
	DashboardConditionalRenderingGroupSpecVisibilityHide DashboardConditionalRenderingGroupSpecVisibility = "hide"
)

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpecCondition string

const (
	DashboardConditionalRenderingGroupSpecConditionAnd DashboardConditionalRenderingGroupSpecCondition = "and"
	DashboardConditionalRenderingGroupSpecConditionOr  DashboardConditionalRenderingGroupSpecCondition = "or"
)

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableSpecOperator string

const (
	DashboardConditionalRenderingVariableSpecOperatorEquals    DashboardConditionalRenderingVariableSpecOperator = "equals"
	DashboardConditionalRenderingVariableSpecOperatorNotEquals DashboardConditionalRenderingVariableSpecOperator = "notEquals"
)

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpecColumnWidthMode string

const (
	DashboardAutoGridLayoutSpecColumnWidthModeNarrow   DashboardAutoGridLayoutSpecColumnWidthMode = "narrow"
	DashboardAutoGridLayoutSpecColumnWidthModeStandard DashboardAutoGridLayoutSpecColumnWidthMode = "standard"
	DashboardAutoGridLayoutSpecColumnWidthModeWide     DashboardAutoGridLayoutSpecColumnWidthMode = "wide"
	DashboardAutoGridLayoutSpecColumnWidthModeCustom   DashboardAutoGridLayoutSpecColumnWidthMode = "custom"
)

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpecRowHeightMode string

const (
	DashboardAutoGridLayoutSpecRowHeightModeShort    DashboardAutoGridLayoutSpecRowHeightMode = "short"
	DashboardAutoGridLayoutSpecRowHeightModeStandard DashboardAutoGridLayoutSpecRowHeightMode = "standard"
	DashboardAutoGridLayoutSpecRowHeightModeTall     DashboardAutoGridLayoutSpecRowHeightMode = "tall"
	DashboardAutoGridLayoutSpecRowHeightModeCustom   DashboardAutoGridLayoutSpecRowHeightMode = "custom"
)

// +k8s:openapi-gen=true
type DashboardTimeSettingsSpecWeekStart string

const (
	DashboardTimeSettingsSpecWeekStartSaturday DashboardTimeSettingsSpecWeekStart = "saturday"
	DashboardTimeSettingsSpecWeekStartMonday   DashboardTimeSettingsSpecWeekStart = "monday"
	DashboardTimeSettingsSpecWeekStartSunday   DashboardTimeSettingsSpecWeekStart = "sunday"
)

// +k8s:openapi-gen=true
type DashboardQueryVariableSpecStaticOptionsOrder string

const (
	DashboardQueryVariableSpecStaticOptionsOrderBefore DashboardQueryVariableSpecStaticOptionsOrder = "before"
	DashboardQueryVariableSpecStaticOptionsOrderAfter  DashboardQueryVariableSpecStaticOptionsOrder = "after"
	DashboardQueryVariableSpecStaticOptionsOrderSorted DashboardQueryVariableSpecStaticOptionsOrder = "sorted"
)

// +k8s:openapi-gen=true
type DashboardPanelKindOrLibraryPanelKind struct {
	PanelKind        *DashboardPanelKind        `json:"PanelKind,omitempty"`
	LibraryPanelKind *DashboardLibraryPanelKind `json:"LibraryPanelKind,omitempty"`
}

// NewDashboardPanelKindOrLibraryPanelKind creates a new DashboardPanelKindOrLibraryPanelKind object.
func NewDashboardPanelKindOrLibraryPanelKind() *DashboardPanelKindOrLibraryPanelKind {
	return &DashboardPanelKindOrLibraryPanelKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardPanelKindOrLibraryPanelKind` as JSON.
func (resource DashboardPanelKindOrLibraryPanelKind) MarshalJSON() ([]byte, error) {
	if resource.PanelKind != nil {
		return json.Marshal(resource.PanelKind)
	}
	if resource.LibraryPanelKind != nil {
		return json.Marshal(resource.LibraryPanelKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardPanelKindOrLibraryPanelKind` from JSON.
func (resource *DashboardPanelKindOrLibraryPanelKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "LibraryPanel":
		var dashboardLibraryPanelKind DashboardLibraryPanelKind
		if err := json.Unmarshal(raw, &dashboardLibraryPanelKind); err != nil {
			return err
		}

		resource.LibraryPanelKind = &dashboardLibraryPanelKind
		return nil
	case "Panel":
		var dashboardPanelKind DashboardPanelKind
		if err := json.Unmarshal(raw, &dashboardPanelKind); err != nil {
			return err
		}

		resource.PanelKind = &dashboardPanelKind
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap struct {
	ValueMap        *DashboardValueMap        `json:"ValueMap,omitempty"`
	RangeMap        *DashboardRangeMap        `json:"RangeMap,omitempty"`
	RegexMap        *DashboardRegexMap        `json:"RegexMap,omitempty"`
	SpecialValueMap *DashboardSpecialValueMap `json:"SpecialValueMap,omitempty"`
}

// NewDashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap creates a new DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap object.
func NewDashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap() *DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap {
	return &DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap` as JSON.
func (resource DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap) MarshalJSON() ([]byte, error) {
	if resource.ValueMap != nil {
		return json.Marshal(resource.ValueMap)
	}
	if resource.RangeMap != nil {
		return json.Marshal(resource.RangeMap)
	}
	if resource.RegexMap != nil {
		return json.Marshal(resource.RegexMap)
	}
	if resource.SpecialValueMap != nil {
		return json.Marshal(resource.SpecialValueMap)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap` from JSON.
func (resource *DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return nil
	}

	switch discriminator {
	case "range":
		var dashboardRangeMap DashboardRangeMap
		if err := json.Unmarshal(raw, &dashboardRangeMap); err != nil {
			return err
		}

		resource.RangeMap = &dashboardRangeMap
		return nil
	case "regex":
		var dashboardRegexMap DashboardRegexMap
		if err := json.Unmarshal(raw, &dashboardRegexMap); err != nil {
			return err
		}

		resource.RegexMap = &dashboardRegexMap
		return nil
	case "special":
		var dashboardSpecialValueMap DashboardSpecialValueMap
		if err := json.Unmarshal(raw, &dashboardSpecialValueMap); err != nil {
			return err
		}

		resource.SpecialValueMap = &dashboardSpecialValueMap
		return nil
	case "value":
		var dashboardValueMap DashboardValueMap
		if err := json.Unmarshal(raw, &dashboardValueMap); err != nil {
			return err
		}

		resource.ValueMap = &dashboardValueMap
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind struct {
	GridLayoutKind     *DashboardGridLayoutKind     `json:"GridLayoutKind,omitempty"`
	AutoGridLayoutKind *DashboardAutoGridLayoutKind `json:"AutoGridLayoutKind,omitempty"`
	TabsLayoutKind     *DashboardTabsLayoutKind     `json:"TabsLayoutKind,omitempty"`
	RowsLayoutKind     *DashboardRowsLayoutKind     `json:"RowsLayoutKind,omitempty"`
}

// NewDashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind creates a new DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind object.
func NewDashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind() *DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind {
	return &DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind` as JSON.
func (resource DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind) MarshalJSON() ([]byte, error) {
	if resource.GridLayoutKind != nil {
		return json.Marshal(resource.GridLayoutKind)
	}
	if resource.AutoGridLayoutKind != nil {
		return json.Marshal(resource.AutoGridLayoutKind)
	}
	if resource.TabsLayoutKind != nil {
		return json.Marshal(resource.TabsLayoutKind)
	}
	if resource.RowsLayoutKind != nil {
		return json.Marshal(resource.RowsLayoutKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind` from JSON.
func (resource *DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "AutoGridLayout":
		var dashboardAutoGridLayoutKind DashboardAutoGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardAutoGridLayoutKind); err != nil {
			return err
		}

		resource.AutoGridLayoutKind = &dashboardAutoGridLayoutKind
		return nil
	case "GridLayout":
		var dashboardGridLayoutKind DashboardGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardGridLayoutKind); err != nil {
			return err
		}

		resource.GridLayoutKind = &dashboardGridLayoutKind
		return nil
	case "RowsLayout":
		var dashboardRowsLayoutKind DashboardRowsLayoutKind
		if err := json.Unmarshal(raw, &dashboardRowsLayoutKind); err != nil {
			return err
		}

		resource.RowsLayoutKind = &dashboardRowsLayoutKind
		return nil
	case "TabsLayout":
		var dashboardTabsLayoutKind DashboardTabsLayoutKind
		if err := json.Unmarshal(raw, &dashboardTabsLayoutKind); err != nil {
			return err
		}

		resource.TabsLayoutKind = &dashboardTabsLayoutKind
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind struct {
	ConditionalRenderingVariableKind      *DashboardConditionalRenderingVariableKind      `json:"ConditionalRenderingVariableKind,omitempty"`
	ConditionalRenderingDataKind          *DashboardConditionalRenderingDataKind          `json:"ConditionalRenderingDataKind,omitempty"`
	ConditionalRenderingTimeRangeSizeKind *DashboardConditionalRenderingTimeRangeSizeKind `json:"ConditionalRenderingTimeRangeSizeKind,omitempty"`
}

// NewDashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind creates a new DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind object.
func NewDashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind() *DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind {
	return &DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind` as JSON.
func (resource DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) MarshalJSON() ([]byte, error) {
	if resource.ConditionalRenderingVariableKind != nil {
		return json.Marshal(resource.ConditionalRenderingVariableKind)
	}
	if resource.ConditionalRenderingDataKind != nil {
		return json.Marshal(resource.ConditionalRenderingDataKind)
	}
	if resource.ConditionalRenderingTimeRangeSizeKind != nil {
		return json.Marshal(resource.ConditionalRenderingTimeRangeSizeKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind` from JSON.
func (resource *DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "ConditionalRenderingData":
		var dashboardConditionalRenderingDataKind DashboardConditionalRenderingDataKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingDataKind); err != nil {
			return err
		}

		resource.ConditionalRenderingDataKind = &dashboardConditionalRenderingDataKind
		return nil
	case "ConditionalRenderingTimeRangeSize":
		var dashboardConditionalRenderingTimeRangeSizeKind DashboardConditionalRenderingTimeRangeSizeKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingTimeRangeSizeKind); err != nil {
			return err
		}

		resource.ConditionalRenderingTimeRangeSizeKind = &dashboardConditionalRenderingTimeRangeSizeKind
		return nil
	case "ConditionalRenderingVariable":
		var dashboardConditionalRenderingVariableKind DashboardConditionalRenderingVariableKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingVariableKind); err != nil {
			return err
		}

		resource.ConditionalRenderingVariableKind = &dashboardConditionalRenderingVariableKind
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind struct {
	GridLayoutKind     *DashboardGridLayoutKind     `json:"GridLayoutKind,omitempty"`
	RowsLayoutKind     *DashboardRowsLayoutKind     `json:"RowsLayoutKind,omitempty"`
	AutoGridLayoutKind *DashboardAutoGridLayoutKind `json:"AutoGridLayoutKind,omitempty"`
	TabsLayoutKind     *DashboardTabsLayoutKind     `json:"TabsLayoutKind,omitempty"`
}

// NewDashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind creates a new DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind object.
func NewDashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind() *DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind {
	return &DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind` as JSON.
func (resource DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) MarshalJSON() ([]byte, error) {
	if resource.GridLayoutKind != nil {
		return json.Marshal(resource.GridLayoutKind)
	}
	if resource.RowsLayoutKind != nil {
		return json.Marshal(resource.RowsLayoutKind)
	}
	if resource.AutoGridLayoutKind != nil {
		return json.Marshal(resource.AutoGridLayoutKind)
	}
	if resource.TabsLayoutKind != nil {
		return json.Marshal(resource.TabsLayoutKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind` from JSON.
func (resource *DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "AutoGridLayout":
		var dashboardAutoGridLayoutKind DashboardAutoGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardAutoGridLayoutKind); err != nil {
			return err
		}

		resource.AutoGridLayoutKind = &dashboardAutoGridLayoutKind
		return nil
	case "GridLayout":
		var dashboardGridLayoutKind DashboardGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardGridLayoutKind); err != nil {
			return err
		}

		resource.GridLayoutKind = &dashboardGridLayoutKind
		return nil
	case "RowsLayout":
		var dashboardRowsLayoutKind DashboardRowsLayoutKind
		if err := json.Unmarshal(raw, &dashboardRowsLayoutKind); err != nil {
			return err
		}

		resource.RowsLayoutKind = &dashboardRowsLayoutKind
		return nil
	case "TabsLayout":
		var dashboardTabsLayoutKind DashboardTabsLayoutKind
		if err := json.Unmarshal(raw, &dashboardTabsLayoutKind); err != nil {
			return err
		}

		resource.TabsLayoutKind = &dashboardTabsLayoutKind
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind struct {
	QueryVariableKind      *DashboardQueryVariableKind      `json:"QueryVariableKind,omitempty"`
	TextVariableKind       *DashboardTextVariableKind       `json:"TextVariableKind,omitempty"`
	ConstantVariableKind   *DashboardConstantVariableKind   `json:"ConstantVariableKind,omitempty"`
	DatasourceVariableKind *DashboardDatasourceVariableKind `json:"DatasourceVariableKind,omitempty"`
	IntervalVariableKind   *DashboardIntervalVariableKind   `json:"IntervalVariableKind,omitempty"`
	CustomVariableKind     *DashboardCustomVariableKind     `json:"CustomVariableKind,omitempty"`
	GroupByVariableKind    *DashboardGroupByVariableKind    `json:"GroupByVariableKind,omitempty"`
	AdhocVariableKind      *DashboardAdhocVariableKind      `json:"AdhocVariableKind,omitempty"`
}

// NewDashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind creates a new DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind object.
func NewDashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind() *DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind {
	return &DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind` as JSON.
func (resource DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind) MarshalJSON() ([]byte, error) {
	if resource.QueryVariableKind != nil {
		return json.Marshal(resource.QueryVariableKind)
	}
	if resource.TextVariableKind != nil {
		return json.Marshal(resource.TextVariableKind)
	}
	if resource.ConstantVariableKind != nil {
		return json.Marshal(resource.ConstantVariableKind)
	}
	if resource.DatasourceVariableKind != nil {
		return json.Marshal(resource.DatasourceVariableKind)
	}
	if resource.IntervalVariableKind != nil {
		return json.Marshal(resource.IntervalVariableKind)
	}
	if resource.CustomVariableKind != nil {
		return json.Marshal(resource.CustomVariableKind)
	}
	if resource.GroupByVariableKind != nil {
		return json.Marshal(resource.GroupByVariableKind)
	}
	if resource.AdhocVariableKind != nil {
		return json.Marshal(resource.AdhocVariableKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind` from JSON.
func (resource *DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "AdhocVariable":
		var dashboardAdhocVariableKind DashboardAdhocVariableKind
		if err := json.Unmarshal(raw, &dashboardAdhocVariableKind); err != nil {
			return err
		}

		resource.AdhocVariableKind = &dashboardAdhocVariableKind
		return nil
	case "ConstantVariable":
		var dashboardConstantVariableKind DashboardConstantVariableKind
		if err := json.Unmarshal(raw, &dashboardConstantVariableKind); err != nil {
			return err
		}

		resource.ConstantVariableKind = &dashboardConstantVariableKind
		return nil
	case "CustomVariable":
		var dashboardCustomVariableKind DashboardCustomVariableKind
		if err := json.Unmarshal(raw, &dashboardCustomVariableKind); err != nil {
			return err
		}

		resource.CustomVariableKind = &dashboardCustomVariableKind
		return nil
	case "DatasourceVariable":
		var dashboardDatasourceVariableKind DashboardDatasourceVariableKind
		if err := json.Unmarshal(raw, &dashboardDatasourceVariableKind); err != nil {
			return err
		}

		resource.DatasourceVariableKind = &dashboardDatasourceVariableKind
		return nil
	case "GroupByVariable":
		var dashboardGroupByVariableKind DashboardGroupByVariableKind
		if err := json.Unmarshal(raw, &dashboardGroupByVariableKind); err != nil {
			return err
		}

		resource.GroupByVariableKind = &dashboardGroupByVariableKind
		return nil
	case "IntervalVariable":
		var dashboardIntervalVariableKind DashboardIntervalVariableKind
		if err := json.Unmarshal(raw, &dashboardIntervalVariableKind); err != nil {
			return err
		}

		resource.IntervalVariableKind = &dashboardIntervalVariableKind
		return nil
	case "QueryVariable":
		var dashboardQueryVariableKind DashboardQueryVariableKind
		if err := json.Unmarshal(raw, &dashboardQueryVariableKind); err != nil {
			return err
		}

		resource.QueryVariableKind = &dashboardQueryVariableKind
		return nil
	case "TextVariable":
		var dashboardTextVariableKind DashboardTextVariableKind
		if err := json.Unmarshal(raw, &dashboardTextVariableKind); err != nil {
			return err
		}

		resource.TextVariableKind = &dashboardTextVariableKind
		return nil
	}

	return nil
}

// +k8s:openapi-gen=true
type DashboardStringOrArrayOfString struct {
	String        *string  `json:"String,omitempty"`
	ArrayOfString []string `json:"ArrayOfString,omitempty"`
}

// NewDashboardStringOrArrayOfString creates a new DashboardStringOrArrayOfString object.
func NewDashboardStringOrArrayOfString() *DashboardStringOrArrayOfString {
	return &DashboardStringOrArrayOfString{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardStringOrArrayOfString` as JSON.
func (resource DashboardStringOrArrayOfString) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.ArrayOfString != nil {
		return json.Marshal(resource.ArrayOfString)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardStringOrArrayOfString` from JSON.
func (resource *DashboardStringOrArrayOfString) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	var errList []error

	// String
	var String string
	if err := json.Unmarshal(raw, &String); err != nil {
		errList = append(errList, err)
		resource.String = nil
	} else {
		resource.String = &String
		return nil
	}

	// ArrayOfString
	var ArrayOfString []string
	if err := json.Unmarshal(raw, &ArrayOfString); err != nil {
		errList = append(errList, err)
		resource.ArrayOfString = nil
	} else {
		resource.ArrayOfString = ArrayOfString
		return nil
	}

	return errors.Join(errList...)
}

// +k8s:openapi-gen=true
type DashboardStringOrFloat64 struct {
	String  *string  `json:"String,omitempty"`
	Float64 *float64 `json:"Float64,omitempty"`
}

// NewDashboardStringOrFloat64 creates a new DashboardStringOrFloat64 object.
func NewDashboardStringOrFloat64() *DashboardStringOrFloat64 {
	return &DashboardStringOrFloat64{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardStringOrFloat64` as JSON.
func (resource DashboardStringOrFloat64) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Float64 != nil {
		return json.Marshal(resource.Float64)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardStringOrFloat64` from JSON.
func (resource *DashboardStringOrFloat64) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	var errList []error

	// String
	var String string
	if err := json.Unmarshal(raw, &String); err != nil {
		errList = append(errList, err)
		resource.String = nil
	} else {
		resource.String = &String
		return nil
	}

	// Float64
	var Float64 float64
	if err := json.Unmarshal(raw, &Float64); err != nil {
		errList = append(errList, err)
		resource.Float64 = nil
	} else {
		resource.Float64 = &Float64
		return nil
	}

	return errors.Join(errList...)
}

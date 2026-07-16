// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

import (
	json "encoding/json"
)

// Time configuration
// It defines the default time config for the time picker, the refresh picker for the specific dashboard.
// +k8s:openapi-gen=true
type NotebookTimeSettingsSpec struct {
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
	QuickRanges []NotebookTimeRangeOption `json:"quickRanges,omitempty"`
	// Whether timepicker is visible or not.
	// v1: timepicker.hidden
	HideTimepicker bool `json:"hideTimepicker"`
	// Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
	WeekStart *NotebookTimeSettingsSpecWeekStart `json:"weekStart,omitempty"`
	// The month that the fiscal year starts on. 0 = January, 11 = December
	FiscalYearStartMonth int64 `json:"fiscalYearStartMonth"`
	// Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
	// v1: timepicker.nowDelay
	NowDelay *string `json:"nowDelay,omitempty"`
}

// NewNotebookTimeSettingsSpec creates a new NotebookTimeSettingsSpec object.
func NewNotebookTimeSettingsSpec() *NotebookTimeSettingsSpec {
	return &NotebookTimeSettingsSpec{
		Timezone:             (func(input string) *string { return &input })("browser"),
		From:                 "now-6h",
		To:                   "now",
		AutoRefresh:          "",
		AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
		HideTimepicker:       false,
		FiscalYearStartMonth: 0,
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookTimeSettingsSpec.
func (NotebookTimeSettingsSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookTimeSettingsSpec"
}

// +k8s:openapi-gen=true
type NotebookTimeRangeOption struct {
	Display string `json:"display"`
	From    string `json:"from"`
	To      string `json:"to"`
}

// NewNotebookTimeRangeOption creates a new NotebookTimeRangeOption object.
func NewNotebookTimeRangeOption() *NotebookTimeRangeOption {
	return &NotebookTimeRangeOption{
		Display: "Last 6 hours",
		From:    "now-6h",
		To:      "now",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookTimeRangeOption.
func (NotebookTimeRangeOption) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookTimeRangeOption"
}

// A notebook element is a narrative cell, a panel, or a library panel. Unlike the dashboard
// Element union, this one includes CellKind — and it is referenced ONLY by NotebookSpec.
// CellKind is listed first so it is the generated default (a notebook is narrative-first).
// +k8s:openapi-gen=true
type NotebookNotebookElement = NotebookCellKindOrPanelKindOrLibraryPanelKind

// NewNotebookNotebookElement creates a new NotebookNotebookElement object.
func NewNotebookNotebookElement() *NotebookNotebookElement {
	return NewNotebookCellKindOrPanelKindOrLibraryPanelKind()
}

// A cell holds non-panel narrative content (markdown text, code) in a notebook layout.
// Panel cells are not represented here — they reuse PanelKind.
// +k8s:openapi-gen=true
type NotebookCellKind struct {
	Kind string           `json:"kind"`
	Spec NotebookCellSpec `json:"spec"`
}

// NewNotebookCellKind creates a new NotebookCellKind object.
func NewNotebookCellKind() *NotebookCellKind {
	return &NotebookCellKind{
		Kind: "Cell",
		Spec: *NewNotebookCellSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookCellKind.
func (NotebookCellKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookCellKind"
}

// +k8s:openapi-gen=true
type NotebookCellSpec struct {
	Content NotebookCellContentKind `json:"content"`
}

// NewNotebookCellSpec creates a new NotebookCellSpec object.
func NewNotebookCellSpec() *NotebookCellSpec {
	return &NotebookCellSpec{
		Content: *NewNotebookCellContentKind(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookCellSpec.
func (NotebookCellSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookCellSpec"
}

// Pluggable cell content discriminated by `kind`. New content types are added
// by extending this union with another <Name>CellContentKind member.
// +k8s:openapi-gen=true
type NotebookCellContentKind = NotebookMarkdownCellContentKindOrCodeCellContentKind

// NewNotebookCellContentKind creates a new NotebookCellContentKind object.
func NewNotebookCellContentKind() *NotebookCellContentKind {
	return NewNotebookMarkdownCellContentKindOrCodeCellContentKind()
}

// +k8s:openapi-gen=true
type NotebookMarkdownCellContentKind struct {
	Kind string                          `json:"kind"`
	Spec NotebookMarkdownCellContentSpec `json:"spec"`
}

// NewNotebookMarkdownCellContentKind creates a new NotebookMarkdownCellContentKind object.
func NewNotebookMarkdownCellContentKind() *NotebookMarkdownCellContentKind {
	return &NotebookMarkdownCellContentKind{
		Kind: "Markdown",
		Spec: *NewNotebookMarkdownCellContentSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookMarkdownCellContentKind.
func (NotebookMarkdownCellContentKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMarkdownCellContentKind"
}

// +k8s:openapi-gen=true
type NotebookMarkdownCellContentSpec struct {
	Text string `json:"text"`
}

// NewNotebookMarkdownCellContentSpec creates a new NotebookMarkdownCellContentSpec object.
func NewNotebookMarkdownCellContentSpec() *NotebookMarkdownCellContentSpec {
	return &NotebookMarkdownCellContentSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookMarkdownCellContentSpec.
func (NotebookMarkdownCellContentSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMarkdownCellContentSpec"
}

// +k8s:openapi-gen=true
type NotebookCodeCellContentKind struct {
	Kind string                      `json:"kind"`
	Spec NotebookCodeCellContentSpec `json:"spec"`
}

// NewNotebookCodeCellContentKind creates a new NotebookCodeCellContentKind object.
func NewNotebookCodeCellContentKind() *NotebookCodeCellContentKind {
	return &NotebookCodeCellContentKind{
		Kind: "Code",
		Spec: *NewNotebookCodeCellContentSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookCodeCellContentKind.
func (NotebookCodeCellContentKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookCodeCellContentKind"
}

// +k8s:openapi-gen=true
type NotebookCodeCellContentSpec struct {
	Language   string  `json:"language"`
	Code       string  `json:"code"`
	Highlight  []int64 `json:"highlight,omitempty"`
	Annotation *string `json:"annotation,omitempty"`
}

// NewNotebookCodeCellContentSpec creates a new NotebookCodeCellContentSpec object.
func NewNotebookCodeCellContentSpec() *NotebookCodeCellContentSpec {
	return &NotebookCodeCellContentSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookCodeCellContentSpec.
func (NotebookCodeCellContentSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookCodeCellContentSpec"
}

// +k8s:openapi-gen=true
type NotebookPanelKind struct {
	Kind string            `json:"kind"`
	Spec NotebookPanelSpec `json:"spec"`
}

// NewNotebookPanelKind creates a new NotebookPanelKind object.
func NewNotebookPanelKind() *NotebookPanelKind {
	return &NotebookPanelKind{
		Kind: "Panel",
		Spec: *NewNotebookPanelSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookPanelKind.
func (NotebookPanelKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookPanelKind"
}

// +k8s:openapi-gen=true
type NotebookPanelSpec struct {
	Id          float64                `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Links       []NotebookDataLink     `json:"links"`
	Data        NotebookQueryGroupKind `json:"data"`
	VizConfig   NotebookVizConfigKind  `json:"vizConfig"`
	Transparent *bool                  `json:"transparent,omitempty"`
}

// NewNotebookPanelSpec creates a new NotebookPanelSpec object.
func NewNotebookPanelSpec() *NotebookPanelSpec {
	return &NotebookPanelSpec{
		Links:     []NotebookDataLink{},
		Data:      *NewNotebookQueryGroupKind(),
		VizConfig: *NewNotebookVizConfigKind(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookPanelSpec.
func (NotebookPanelSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookPanelSpec"
}

// +k8s:openapi-gen=true
type NotebookDataLink struct {
	Title       string `json:"title"`
	Url         string `json:"url"`
	TargetBlank *bool  `json:"targetBlank,omitempty"`
}

// NewNotebookDataLink creates a new NotebookDataLink object.
func NewNotebookDataLink() *NotebookDataLink {
	return &NotebookDataLink{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookDataLink.
func (NotebookDataLink) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookDataLink"
}

// +k8s:openapi-gen=true
type NotebookQueryGroupKind struct {
	Kind string                 `json:"kind"`
	Spec NotebookQueryGroupSpec `json:"spec"`
}

// NewNotebookQueryGroupKind creates a new NotebookQueryGroupKind object.
func NewNotebookQueryGroupKind() *NotebookQueryGroupKind {
	return &NotebookQueryGroupKind{
		Kind: "QueryGroup",
		Spec: *NewNotebookQueryGroupSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookQueryGroupKind.
func (NotebookQueryGroupKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookQueryGroupKind"
}

// +k8s:openapi-gen=true
type NotebookQueryGroupSpec struct {
	Queries         []NotebookPanelQueryKind     `json:"queries"`
	Transformations []NotebookTransformationKind `json:"transformations"`
	QueryOptions    NotebookQueryOptionsSpec     `json:"queryOptions"`
}

// NewNotebookQueryGroupSpec creates a new NotebookQueryGroupSpec object.
func NewNotebookQueryGroupSpec() *NotebookQueryGroupSpec {
	return &NotebookQueryGroupSpec{
		Queries:         []NotebookPanelQueryKind{},
		Transformations: []NotebookTransformationKind{},
		QueryOptions:    *NewNotebookQueryOptionsSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookQueryGroupSpec.
func (NotebookQueryGroupSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookQueryGroupSpec"
}

// +k8s:openapi-gen=true
type NotebookPanelQueryKind struct {
	Kind string                 `json:"kind"`
	Spec NotebookPanelQuerySpec `json:"spec"`
}

// NewNotebookPanelQueryKind creates a new NotebookPanelQueryKind object.
func NewNotebookPanelQueryKind() *NotebookPanelQueryKind {
	return &NotebookPanelQueryKind{
		Kind: "PanelQuery",
		Spec: *NewNotebookPanelQuerySpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookPanelQueryKind.
func (NotebookPanelQueryKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookPanelQueryKind"
}

// +k8s:openapi-gen=true
type NotebookPanelQuerySpec struct {
	Query  NotebookDataQueryKind `json:"query"`
	RefId  string                `json:"refId"`
	Hidden bool                  `json:"hidden"`
}

// NewNotebookPanelQuerySpec creates a new NotebookPanelQuerySpec object.
func NewNotebookPanelQuerySpec() *NotebookPanelQuerySpec {
	return &NotebookPanelQuerySpec{
		Query: *NewNotebookDataQueryKind(),
		RefId: "A",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookPanelQuerySpec.
func (NotebookPanelQuerySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookPanelQuerySpec"
}

// +k8s:openapi-gen=true
type NotebookDataQueryKind struct {
	Kind    string            `json:"kind"`
	Group   string            `json:"group"`
	Version string            `json:"version"`
	Labels  map[string]string `json:"labels,omitempty"`
	// New type for datasource reference
	// Not creating a new type until we figure out how to handle DS refs for group by, adhoc, and every place that uses DataSourceRef in TS.
	Datasource *NotebookV2beta1DataQueryKindDatasource `json:"datasource,omitempty"`
	Spec       map[string]interface{}                  `json:"spec"`
}

// NewNotebookDataQueryKind creates a new NotebookDataQueryKind object.
func NewNotebookDataQueryKind() *NotebookDataQueryKind {
	return &NotebookDataQueryKind{
		Kind:    "DataQuery",
		Version: "v0",
		Spec:    map[string]interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookDataQueryKind.
func (NotebookDataQueryKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookDataQueryKind"
}

// +k8s:openapi-gen=true
type NotebookTransformationKind struct {
	// The kind of a TransformationKind is the transformation ID
	Kind string                        `json:"kind"`
	Spec NotebookDataTransformerConfig `json:"spec"`
}

// NewNotebookTransformationKind creates a new NotebookTransformationKind object.
func NewNotebookTransformationKind() *NotebookTransformationKind {
	return &NotebookTransformationKind{
		Spec: *NewNotebookDataTransformerConfig(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookTransformationKind.
func (NotebookTransformationKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookTransformationKind"
}

// Transformations allow to manipulate data returned by a query before the system applies a visualization.
// Using transformations you can: rename fields, join time series data, perform mathematical operations across queries,
// use the output of one transformation as the input to another transformation, etc.
// +k8s:openapi-gen=true
type NotebookDataTransformerConfig struct {
	// Unique identifier of transformer
	Id string `json:"id"`
	// Disabled transformations are skipped
	Disabled *bool `json:"disabled,omitempty"`
	// Optional frame matcher. When missing it will be applied to all results
	Filter *NotebookMatcherConfig `json:"filter,omitempty"`
	// Where to pull DataFrames from as input to transformation
	Topic *NotebookDataTopic `json:"topic,omitempty"`
	// Options to be passed to the transformer
	// Valid options depend on the transformer id
	Options interface{} `json:"options"`
}

// NewNotebookDataTransformerConfig creates a new NotebookDataTransformerConfig object.
func NewNotebookDataTransformerConfig() *NotebookDataTransformerConfig {
	return &NotebookDataTransformerConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookDataTransformerConfig.
func (NotebookDataTransformerConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookDataTransformerConfig"
}

// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
// +k8s:openapi-gen=true
type NotebookMatcherConfig struct {
	// The matcher id. This is used to find the matcher implementation from registry.
	Id string `json:"id"`
	// If set, limits this matcher to fields of that type. If not set, "series" mode is used.
	Scope *NotebookMatcherScope `json:"scope,omitempty"`
	// The matcher options. This is specific to the matcher implementation.
	Options interface{} `json:"options,omitempty"`
}

// NewNotebookMatcherConfig creates a new NotebookMatcherConfig object.
func NewNotebookMatcherConfig() *NotebookMatcherConfig {
	return &NotebookMatcherConfig{
		Id: "",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookMatcherConfig.
func (NotebookMatcherConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMatcherConfig"
}

// +k8s:openapi-gen=true
type NotebookMatcherScope string

const (
	NotebookMatcherScopeSeries     NotebookMatcherScope = "series"
	NotebookMatcherScopeNested     NotebookMatcherScope = "nested"
	NotebookMatcherScopeAnnotation NotebookMatcherScope = "annotation"
	NotebookMatcherScopeExemplar   NotebookMatcherScope = "exemplar"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookMatcherScope.
func (NotebookMatcherScope) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMatcherScope"
}

// A topic is attached to DataFrame metadata in query results.
// This specifies where the data should be used.
// +k8s:openapi-gen=true
type NotebookDataTopic string

const (
	NotebookDataTopicSeries      NotebookDataTopic = "series"
	NotebookDataTopicAnnotations NotebookDataTopic = "annotations"
	NotebookDataTopicAlertStates NotebookDataTopic = "alertStates"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookDataTopic.
func (NotebookDataTopic) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookDataTopic"
}

// +k8s:openapi-gen=true
type NotebookQueryOptionsSpec struct {
	TimeFrom         *string `json:"timeFrom,omitempty"`
	MaxDataPoints    *int64  `json:"maxDataPoints,omitempty"`
	TimeShift        *string `json:"timeShift,omitempty"`
	QueryCachingTTL  *int64  `json:"queryCachingTTL,omitempty"`
	Interval         *string `json:"interval,omitempty"`
	CacheTimeout     *string `json:"cacheTimeout,omitempty"`
	HideTimeOverride *bool   `json:"hideTimeOverride,omitempty"`
	TimeCompare      *string `json:"timeCompare,omitempty"`
}

// NewNotebookQueryOptionsSpec creates a new NotebookQueryOptionsSpec object.
func NewNotebookQueryOptionsSpec() *NotebookQueryOptionsSpec {
	return &NotebookQueryOptionsSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookQueryOptionsSpec.
func (NotebookQueryOptionsSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookQueryOptionsSpec"
}

// +k8s:openapi-gen=true
type NotebookVizConfigKind struct {
	Kind string `json:"kind"`
	// The group is the plugin ID
	Group   string                `json:"group"`
	Version string                `json:"version"`
	Spec    NotebookVizConfigSpec `json:"spec"`
}

// NewNotebookVizConfigKind creates a new NotebookVizConfigKind object.
func NewNotebookVizConfigKind() *NotebookVizConfigKind {
	return &NotebookVizConfigKind{
		Kind: "VizConfig",
		Spec: *NewNotebookVizConfigSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookVizConfigKind.
func (NotebookVizConfigKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookVizConfigKind"
}

// --- Kinds ---
// +k8s:openapi-gen=true
type NotebookVizConfigSpec struct {
	Options     map[string]interface{}    `json:"options"`
	FieldConfig NotebookFieldConfigSource `json:"fieldConfig"`
}

// NewNotebookVizConfigSpec creates a new NotebookVizConfigSpec object.
func NewNotebookVizConfigSpec() *NotebookVizConfigSpec {
	return &NotebookVizConfigSpec{
		Options:     map[string]interface{}{},
		FieldConfig: *NewNotebookFieldConfigSource(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookVizConfigSpec.
func (NotebookVizConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookVizConfigSpec"
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
// +k8s:openapi-gen=true
type NotebookFieldConfigSource struct {
	// Defaults are the options applied to all fields.
	Defaults NotebookFieldConfig `json:"defaults"`
	// Overrides are the options applied to specific fields overriding the defaults.
	Overrides []NotebookV2beta1FieldConfigSourceOverrides `json:"overrides"`
}

// NewNotebookFieldConfigSource creates a new NotebookFieldConfigSource object.
func NewNotebookFieldConfigSource() *NotebookFieldConfigSource {
	return &NotebookFieldConfigSource{
		Defaults:  *NewNotebookFieldConfig(),
		Overrides: []NotebookV2beta1FieldConfigSourceOverrides{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookFieldConfigSource.
func (NotebookFieldConfigSource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFieldConfigSource"
}

// The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.
// Each column within this structure is called a field. A field can represent a single time series or table column.
// Field options allow you to change how the data is displayed in your visualizations.
// +k8s:openapi-gen=true
type NotebookFieldConfig struct {
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
	// You can use the units ID available in Grafana or a custom unit.
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
	Mappings []NotebookValueMapping `json:"mappings,omitempty"`
	// Map numeric values to states
	Thresholds *NotebookThresholdsConfig `json:"thresholds,omitempty"`
	// Panel color configuration
	Color *NotebookFieldColor `json:"color,omitempty"`
	// The behavior when clicking on a result
	Links []interface{} `json:"links,omitempty"`
	// Define interactive HTTP requests that can be triggered from data visualizations.
	Actions []NotebookAction `json:"actions,omitempty"`
	// Alternative to empty string
	NoValue *string `json:"noValue,omitempty"`
	// custom is specified by the FieldConfig field
	// in panel plugin schemas.
	Custom map[string]interface{} `json:"custom,omitempty"`
	// Calculate min max per field
	FieldMinMax *bool `json:"fieldMinMax,omitempty"`
	// How null values should be handled when calculating field stats
	// "null" - Include null values, "connected" - Ignore nulls, "null as zero" - Treat nulls as zero
	NullValueMode *NotebookNullValueMode `json:"nullValueMode,omitempty"`
}

// NewNotebookFieldConfig creates a new NotebookFieldConfig object.
func NewNotebookFieldConfig() *NotebookFieldConfig {
	return &NotebookFieldConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookFieldConfig.
func (NotebookFieldConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFieldConfig"
}

// +k8s:openapi-gen=true
type NotebookValueMapping = NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap

// NewNotebookValueMapping creates a new NotebookValueMapping object.
func NewNotebookValueMapping() *NotebookValueMapping {
	return NewNotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap()
}

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// +k8s:openapi-gen=true
type NotebookValueMap struct {
	Type NotebookMappingType `json:"type"`
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	Options map[string]NotebookValueMappingResult `json:"options"`
}

// NewNotebookValueMap creates a new NotebookValueMap object.
func NewNotebookValueMap() *NotebookValueMap {
	return &NotebookValueMap{
		Type:    NotebookMappingTypeValue,
		Options: map[string]NotebookValueMappingResult{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookValueMap.
func (NotebookValueMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookValueMap"
}

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
// +k8s:openapi-gen=true
type NotebookMappingType string

const (
	NotebookMappingTypeValue   NotebookMappingType = "value"
	NotebookMappingTypeRange   NotebookMappingType = "range"
	NotebookMappingTypeRegex   NotebookMappingType = "regex"
	NotebookMappingTypeSpecial NotebookMappingType = "special"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookMappingType.
func (NotebookMappingType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMappingType"
}

// Result used as replacement with text and color when the value matches
// +k8s:openapi-gen=true
type NotebookValueMappingResult struct {
	// Text to display when the value matches
	Text *string `json:"text,omitempty"`
	// Text to use when the value matches
	Color *string `json:"color,omitempty"`
	// Icon to display when the value matches. Only specific visualizations.
	Icon *string `json:"icon,omitempty"`
	// Position in the mapping array. Only used internally.
	Index *int32 `json:"index,omitempty"`
}

// NewNotebookValueMappingResult creates a new NotebookValueMappingResult object.
func NewNotebookValueMappingResult() *NotebookValueMappingResult {
	return &NotebookValueMappingResult{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookValueMappingResult.
func (NotebookValueMappingResult) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookValueMappingResult"
}

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// +k8s:openapi-gen=true
type NotebookRangeMap struct {
	Type NotebookMappingType `json:"type"`
	// Range to match against and the result to apply when the value is within the range
	Options NotebookV2beta1RangeMapOptions `json:"options"`
}

// NewNotebookRangeMap creates a new NotebookRangeMap object.
func NewNotebookRangeMap() *NotebookRangeMap {
	return &NotebookRangeMap{
		Type:    NotebookMappingTypeRange,
		Options: *NewNotebookV2beta1RangeMapOptions(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookRangeMap.
func (NotebookRangeMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookRangeMap"
}

// Maps regular expressions to replacement text and a color.
// For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// +k8s:openapi-gen=true
type NotebookRegexMap struct {
	Type NotebookMappingType `json:"type"`
	// Regular expression to match against and the result to apply when the value matches the regex
	Options NotebookV2beta1RegexMapOptions `json:"options"`
}

// NewNotebookRegexMap creates a new NotebookRegexMap object.
func NewNotebookRegexMap() *NotebookRegexMap {
	return &NotebookRegexMap{
		Type:    NotebookMappingTypeRegex,
		Options: *NewNotebookV2beta1RegexMapOptions(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookRegexMap.
func (NotebookRegexMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookRegexMap"
}

// Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.
// See SpecialValueMatch to see the list of special values.
// For example, you can configure a special value mapping so that null values appear as N/A.
// +k8s:openapi-gen=true
type NotebookSpecialValueMap struct {
	Type    NotebookMappingType                   `json:"type"`
	Options NotebookV2beta1SpecialValueMapOptions `json:"options"`
}

// NewNotebookSpecialValueMap creates a new NotebookSpecialValueMap object.
func NewNotebookSpecialValueMap() *NotebookSpecialValueMap {
	return &NotebookSpecialValueMap{
		Type:    NotebookMappingTypeSpecial,
		Options: *NewNotebookV2beta1SpecialValueMapOptions(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookSpecialValueMap.
func (NotebookSpecialValueMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookSpecialValueMap"
}

// Special value types supported by the `SpecialValueMap`
// +k8s:openapi-gen=true
type NotebookSpecialValueMatch string

const (
	NotebookSpecialValueMatchTrue       NotebookSpecialValueMatch = "true"
	NotebookSpecialValueMatchFalse      NotebookSpecialValueMatch = "false"
	NotebookSpecialValueMatchNull       NotebookSpecialValueMatch = "null"
	NotebookSpecialValueMatchNaN        NotebookSpecialValueMatch = "nan"
	NotebookSpecialValueMatchNullAndNaN NotebookSpecialValueMatch = "null+nan"
	NotebookSpecialValueMatchEmpty      NotebookSpecialValueMatch = "empty"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookSpecialValueMatch.
func (NotebookSpecialValueMatch) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookSpecialValueMatch"
}

// +k8s:openapi-gen=true
type NotebookThresholdsConfig struct {
	Mode  NotebookThresholdsMode `json:"mode"`
	Steps []NotebookThreshold    `json:"steps"`
}

// NewNotebookThresholdsConfig creates a new NotebookThresholdsConfig object.
func NewNotebookThresholdsConfig() *NotebookThresholdsConfig {
	return &NotebookThresholdsConfig{
		Steps: []NotebookThreshold{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookThresholdsConfig.
func (NotebookThresholdsConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookThresholdsConfig"
}

// +k8s:openapi-gen=true
type NotebookThresholdsMode string

const (
	NotebookThresholdsModeAbsolute   NotebookThresholdsMode = "absolute"
	NotebookThresholdsModePercentage NotebookThresholdsMode = "percentage"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookThresholdsMode.
func (NotebookThresholdsMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookThresholdsMode"
}

// +k8s:openapi-gen=true
type NotebookThreshold struct {
	// Value null means -Infinity
	Value *float64 `json:"value"`
	// Optional dashboard-variable expression (e.g. `$myVar`) resolved at render time; `value` is the numeric fallback when the expression cannot be resolved to a single finite number.
	ValueExpr *string `json:"valueExpr,omitempty"`
	Color     string  `json:"color"`
}

// NewNotebookThreshold creates a new NotebookThreshold object.
func NewNotebookThreshold() *NotebookThreshold {
	return &NotebookThreshold{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookThreshold.
func (NotebookThreshold) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookThreshold"
}

// Map a field to a color.
// +k8s:openapi-gen=true
type NotebookFieldColor struct {
	// The main color scheme mode.
	Mode NotebookFieldColorModeId `json:"mode"`
	// The fixed color value for fixed or shades color modes.
	FixedColor *string `json:"fixedColor,omitempty"`
	// The end color for the gradient color mode (smallest value). Only used when mode is gradient.
	GradientColorTo *string `json:"gradientColorTo,omitempty"`
	// Some visualizations need to know how to assign a series color from by value color schemes.
	SeriesBy *NotebookFieldColorSeriesByMode `json:"seriesBy,omitempty"`
}

// NewNotebookFieldColor creates a new NotebookFieldColor object.
func NewNotebookFieldColor() *NotebookFieldColor {
	return &NotebookFieldColor{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookFieldColor.
func (NotebookFieldColor) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFieldColor"
}

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
// +k8s:openapi-gen=true
type NotebookFieldColorModeId string

const (
	NotebookFieldColorModeIdThresholds              NotebookFieldColorModeId = "thresholds"
	NotebookFieldColorModeIdPaletteClassic          NotebookFieldColorModeId = "palette-classic"
	NotebookFieldColorModeIdPaletteClassicByName    NotebookFieldColorModeId = "palette-classic-by-name"
	NotebookFieldColorModeIdPaletteColorblind       NotebookFieldColorModeId = "palette-colorblind"
	NotebookFieldColorModeIdPaletteCategoricalNext  NotebookFieldColorModeId = "palette-categorical-next"
	NotebookFieldColorModeIdPaletteCategoricalNext2 NotebookFieldColorModeId = "palette-categorical-next-2"
	NotebookFieldColorModeIdPaletteCategoricalNext3 NotebookFieldColorModeId = "palette-categorical-next-3"
	NotebookFieldColorModeIdContinuousViridis       NotebookFieldColorModeId = "continuous-viridis"
	NotebookFieldColorModeIdContinuousMagma         NotebookFieldColorModeId = "continuous-magma"
	NotebookFieldColorModeIdContinuousPlasma        NotebookFieldColorModeId = "continuous-plasma"
	NotebookFieldColorModeIdContinuousInferno       NotebookFieldColorModeId = "continuous-inferno"
	NotebookFieldColorModeIdContinuousCividis       NotebookFieldColorModeId = "continuous-cividis"
	NotebookFieldColorModeIdContinuousGrYlRd        NotebookFieldColorModeId = "continuous-GrYlRd"
	NotebookFieldColorModeIdContinuousRdYlGr        NotebookFieldColorModeId = "continuous-RdYlGr"
	NotebookFieldColorModeIdContinuousBlYlRd        NotebookFieldColorModeId = "continuous-BlYlRd"
	NotebookFieldColorModeIdContinuousYlRd          NotebookFieldColorModeId = "continuous-YlRd"
	NotebookFieldColorModeIdContinuousBlPu          NotebookFieldColorModeId = "continuous-BlPu"
	NotebookFieldColorModeIdContinuousYlBl          NotebookFieldColorModeId = "continuous-YlBl"
	NotebookFieldColorModeIdContinuousBlues         NotebookFieldColorModeId = "continuous-blues"
	NotebookFieldColorModeIdContinuousReds          NotebookFieldColorModeId = "continuous-reds"
	NotebookFieldColorModeIdContinuousGreens        NotebookFieldColorModeId = "continuous-greens"
	NotebookFieldColorModeIdContinuousPurples       NotebookFieldColorModeId = "continuous-purples"
	NotebookFieldColorModeIdFixed                   NotebookFieldColorModeId = "fixed"
	NotebookFieldColorModeIdShades                  NotebookFieldColorModeId = "shades"
	NotebookFieldColorModeIdGradient                NotebookFieldColorModeId = "gradient"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookFieldColorModeId.
func (NotebookFieldColorModeId) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFieldColorModeId"
}

// Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
// +k8s:openapi-gen=true
type NotebookFieldColorSeriesByMode string

const (
	NotebookFieldColorSeriesByModeMin  NotebookFieldColorSeriesByMode = "min"
	NotebookFieldColorSeriesByModeMax  NotebookFieldColorSeriesByMode = "max"
	NotebookFieldColorSeriesByModeLast NotebookFieldColorSeriesByMode = "last"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookFieldColorSeriesByMode.
func (NotebookFieldColorSeriesByMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFieldColorSeriesByMode"
}

// +k8s:openapi-gen=true
type NotebookAction struct {
	Type         NotebookActionType          `json:"type"`
	Title        string                      `json:"title"`
	Fetch        *NotebookFetchOptions       `json:"fetch,omitempty"`
	Infinity     *NotebookInfinityOptions    `json:"infinity,omitempty"`
	Confirmation *string                     `json:"confirmation,omitempty"`
	OneClick     *bool                       `json:"oneClick,omitempty"`
	Variables    []NotebookActionVariable    `json:"variables,omitempty"`
	Style        *NotebookV2beta1ActionStyle `json:"style,omitempty"`
}

// NewNotebookAction creates a new NotebookAction object.
func NewNotebookAction() *NotebookAction {
	return &NotebookAction{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookAction.
func (NotebookAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookAction"
}

// +k8s:openapi-gen=true
type NotebookActionType string

const (
	NotebookActionTypeFetch    NotebookActionType = "fetch"
	NotebookActionTypeInfinity NotebookActionType = "infinity"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookActionType.
func (NotebookActionType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookActionType"
}

// +k8s:openapi-gen=true
type NotebookFetchOptions struct {
	Method NotebookHttpRequestMethod `json:"method"`
	Url    string                    `json:"url"`
	Body   *string                   `json:"body,omitempty"`
	// These are 2D arrays of strings, each representing a key-value pair
	// We are defining them this way because we can't generate a go struct that
	// that would have exactly two strings in each sub-array
	QueryParams [][]string `json:"queryParams,omitempty"`
	Headers     [][]string `json:"headers,omitempty"`
}

// NewNotebookFetchOptions creates a new NotebookFetchOptions object.
func NewNotebookFetchOptions() *NotebookFetchOptions {
	return &NotebookFetchOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookFetchOptions.
func (NotebookFetchOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookFetchOptions"
}

// +k8s:openapi-gen=true
type NotebookHttpRequestMethod string

const (
	NotebookHttpRequestMethodGET    NotebookHttpRequestMethod = "GET"
	NotebookHttpRequestMethodPUT    NotebookHttpRequestMethod = "PUT"
	NotebookHttpRequestMethodPOST   NotebookHttpRequestMethod = "POST"
	NotebookHttpRequestMethodDELETE NotebookHttpRequestMethod = "DELETE"
	NotebookHttpRequestMethodPATCH  NotebookHttpRequestMethod = "PATCH"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookHttpRequestMethod.
func (NotebookHttpRequestMethod) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookHttpRequestMethod"
}

// +k8s:openapi-gen=true
type NotebookInfinityOptions struct {
	Method NotebookHttpRequestMethod `json:"method"`
	Url    string                    `json:"url"`
	Body   *string                   `json:"body,omitempty"`
	// These are 2D arrays of strings, each representing a key-value pair
	// We are defining them this way because we can't generate a go struct that
	// that would have exactly two strings in each sub-array
	QueryParams   [][]string `json:"queryParams,omitempty"`
	DatasourceUid string     `json:"datasourceUid"`
	Headers       [][]string `json:"headers,omitempty"`
}

// NewNotebookInfinityOptions creates a new NotebookInfinityOptions object.
func NewNotebookInfinityOptions() *NotebookInfinityOptions {
	return &NotebookInfinityOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookInfinityOptions.
func (NotebookInfinityOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookInfinityOptions"
}

// +k8s:openapi-gen=true
type NotebookActionVariable struct {
	Key  string `json:"key"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// NewNotebookActionVariable creates a new NotebookActionVariable object.
func NewNotebookActionVariable() *NotebookActionVariable {
	return &NotebookActionVariable{
		Type: NotebookActionVariableType,
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookActionVariable.
func (NotebookActionVariable) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookActionVariable"
}

// Action variable type
// +k8s:openapi-gen=true
const NotebookActionVariableType = "string"

// How null values should be handled
// +k8s:openapi-gen=true
type NotebookNullValueMode string

const (
	NotebookNullValueModeNull       NotebookNullValueMode = "null"
	NotebookNullValueModeConnected  NotebookNullValueMode = "connected"
	NotebookNullValueModeNullAsZero NotebookNullValueMode = "null as zero"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookNullValueMode.
func (NotebookNullValueMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNullValueMode"
}

// +k8s:openapi-gen=true
type NotebookDynamicConfigValue struct {
	Id    string      `json:"id"`
	Value interface{} `json:"value,omitempty"`
}

// NewNotebookDynamicConfigValue creates a new NotebookDynamicConfigValue object.
func NewNotebookDynamicConfigValue() *NotebookDynamicConfigValue {
	return &NotebookDynamicConfigValue{
		Id: "",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookDynamicConfigValue.
func (NotebookDynamicConfigValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookDynamicConfigValue"
}

// +k8s:openapi-gen=true
type NotebookLibraryPanelKind struct {
	Kind string                       `json:"kind"`
	Spec NotebookLibraryPanelKindSpec `json:"spec"`
}

// NewNotebookLibraryPanelKind creates a new NotebookLibraryPanelKind object.
func NewNotebookLibraryPanelKind() *NotebookLibraryPanelKind {
	return &NotebookLibraryPanelKind{
		Kind: "LibraryPanel",
		Spec: *NewNotebookLibraryPanelKindSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookLibraryPanelKind.
func (NotebookLibraryPanelKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookLibraryPanelKind"
}

// +k8s:openapi-gen=true
type NotebookLibraryPanelKindSpec struct {
	// Panel ID for the library panel in the dashboard
	Id float64 `json:"id"`
	// Title for the library panel in the dashboard
	Title        string                  `json:"title"`
	LibraryPanel NotebookLibraryPanelRef `json:"libraryPanel"`
}

// NewNotebookLibraryPanelKindSpec creates a new NotebookLibraryPanelKindSpec object.
func NewNotebookLibraryPanelKindSpec() *NotebookLibraryPanelKindSpec {
	return &NotebookLibraryPanelKindSpec{
		LibraryPanel: *NewNotebookLibraryPanelRef(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookLibraryPanelKindSpec.
func (NotebookLibraryPanelKindSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookLibraryPanelKindSpec"
}

// A library panel is a reusable panel that you can use in any dashboard.
// When you make a change to a library panel, that change propagates to all instances of where the panel is used.
// Library panels streamline reuse of panels across multiple dashboards.
// +k8s:openapi-gen=true
type NotebookLibraryPanelRef struct {
	// Library panel name
	Name string `json:"name"`
	// Library panel uid
	Uid string `json:"uid"`
}

// NewNotebookLibraryPanelRef creates a new NotebookLibraryPanelRef object.
func NewNotebookLibraryPanelRef() *NotebookLibraryPanelRef {
	return &NotebookLibraryPanelRef{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookLibraryPanelRef.
func (NotebookLibraryPanelRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookLibraryPanelRef"
}

// +k8s:openapi-gen=true
type NotebookNotebookLayoutKind struct {
	Kind string                     `json:"kind"`
	Spec NotebookNotebookLayoutSpec `json:"spec"`
}

// NewNotebookNotebookLayoutKind creates a new NotebookNotebookLayoutKind object.
func NewNotebookNotebookLayoutKind() *NotebookNotebookLayoutKind {
	return &NotebookNotebookLayoutKind{
		Kind: "NotebookLayout",
		Spec: *NewNotebookNotebookLayoutSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookNotebookLayoutKind.
func (NotebookNotebookLayoutKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNotebookLayoutKind"
}

// +k8s:openapi-gen=true
type NotebookNotebookLayoutSpec struct {
	Cells []NotebookNotebookLayoutItemKind `json:"cells"`
}

// NewNotebookNotebookLayoutSpec creates a new NotebookNotebookLayoutSpec object.
func NewNotebookNotebookLayoutSpec() *NotebookNotebookLayoutSpec {
	return &NotebookNotebookLayoutSpec{
		Cells: []NotebookNotebookLayoutItemKind{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookNotebookLayoutSpec.
func (NotebookNotebookLayoutSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNotebookLayoutSpec"
}

// +k8s:openapi-gen=true
type NotebookNotebookLayoutItemKind struct {
	Kind string                         `json:"kind"`
	Spec NotebookNotebookLayoutItemSpec `json:"spec"`
}

// NewNotebookNotebookLayoutItemKind creates a new NotebookNotebookLayoutItemKind object.
func NewNotebookNotebookLayoutItemKind() *NotebookNotebookLayoutItemKind {
	return &NotebookNotebookLayoutItemKind{
		Kind: "NotebookLayoutItem",
		Spec: *NewNotebookNotebookLayoutItemSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookNotebookLayoutItemKind.
func (NotebookNotebookLayoutItemKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNotebookLayoutItemKind"
}

// One ordered item in a notebook layout. `element` references either a CellKind
// (markdown/code content) or a PanelKind in the notebook's elements map. `source`
// records who authored the cell; `collapsed` hides the body in the UI.
// +k8s:openapi-gen=true
type NotebookNotebookLayoutItemSpec struct {
	Element   NotebookElementReference             `json:"element"`
	Source    NotebookNotebookLayoutItemSpecSource `json:"source"`
	Collapsed *bool                                `json:"collapsed,omitempty"`
}

// NewNotebookNotebookLayoutItemSpec creates a new NotebookNotebookLayoutItemSpec object.
func NewNotebookNotebookLayoutItemSpec() *NotebookNotebookLayoutItemSpec {
	return &NotebookNotebookLayoutItemSpec{
		Element: *NewNotebookElementReference(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookNotebookLayoutItemSpec.
func (NotebookNotebookLayoutItemSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNotebookLayoutItemSpec"
}

// +k8s:openapi-gen=true
type NotebookElementReference struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// NewNotebookElementReference creates a new NotebookElementReference object.
func NewNotebookElementReference() *NotebookElementReference {
	return &NotebookElementReference{
		Kind: "ElementReference",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookElementReference.
func (NotebookElementReference) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookElementReference"
}

// +k8s:openapi-gen=true
type NotebookSpec struct {
	Title        string                             `json:"title"`
	Description  *string                            `json:"description,omitempty"`
	Tags         []string                           `json:"tags"`
	TimeSettings NotebookTimeSettingsSpec           `json:"timeSettings"`
	Elements     map[string]NotebookNotebookElement `json:"elements"`
	Layout       NotebookNotebookLayoutKind         `json:"layout"`
}

// NewNotebookSpec creates a new NotebookSpec object.
func NewNotebookSpec() *NotebookSpec {
	return &NotebookSpec{
		Tags:         []string{},
		TimeSettings: *NewNotebookTimeSettingsSpec(),
		Elements:     map[string]NotebookNotebookElement{},
		Layout:       *NewNotebookNotebookLayoutKind(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookSpec.
func (NotebookSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookSpec"
}

// +k8s:openapi-gen=true
type NotebookV2beta1DataQueryKindDatasource struct {
	Name *string `json:"name,omitempty"`
}

// NewNotebookV2beta1DataQueryKindDatasource creates a new NotebookV2beta1DataQueryKindDatasource object.
func NewNotebookV2beta1DataQueryKindDatasource() *NotebookV2beta1DataQueryKindDatasource {
	return &NotebookV2beta1DataQueryKindDatasource{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1DataQueryKindDatasource.
func (NotebookV2beta1DataQueryKindDatasource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1DataQueryKindDatasource"
}

// +k8s:openapi-gen=true
type NotebookV2beta1FieldConfigSourceOverrides struct {
	// Describes config override rules created when interacting with Grafana.
	SystemRef  *string                      `json:"__systemRef,omitempty"`
	Matcher    NotebookMatcherConfig        `json:"matcher"`
	Properties []NotebookDynamicConfigValue `json:"properties"`
}

// NewNotebookV2beta1FieldConfigSourceOverrides creates a new NotebookV2beta1FieldConfigSourceOverrides object.
func NewNotebookV2beta1FieldConfigSourceOverrides() *NotebookV2beta1FieldConfigSourceOverrides {
	return &NotebookV2beta1FieldConfigSourceOverrides{
		Matcher:    *NewNotebookMatcherConfig(),
		Properties: []NotebookDynamicConfigValue{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1FieldConfigSourceOverrides.
func (NotebookV2beta1FieldConfigSourceOverrides) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1FieldConfigSourceOverrides"
}

// +k8s:openapi-gen=true
type NotebookV2beta1RangeMapOptions struct {
	// Min value of the range. It can be null which means -Infinity
	From *float64 `json:"from"`
	// Max value of the range. It can be null which means +Infinity
	To *float64 `json:"to"`
	// Config to apply when the value is within the range
	Result NotebookValueMappingResult `json:"result"`
}

// NewNotebookV2beta1RangeMapOptions creates a new NotebookV2beta1RangeMapOptions object.
func NewNotebookV2beta1RangeMapOptions() *NotebookV2beta1RangeMapOptions {
	return &NotebookV2beta1RangeMapOptions{
		Result: *NewNotebookValueMappingResult(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1RangeMapOptions.
func (NotebookV2beta1RangeMapOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1RangeMapOptions"
}

// +k8s:openapi-gen=true
type NotebookV2beta1RegexMapOptions struct {
	// Regular expression to match against
	Pattern string `json:"pattern"`
	// Config to apply when the value matches the regex
	Result NotebookValueMappingResult `json:"result"`
}

// NewNotebookV2beta1RegexMapOptions creates a new NotebookV2beta1RegexMapOptions object.
func NewNotebookV2beta1RegexMapOptions() *NotebookV2beta1RegexMapOptions {
	return &NotebookV2beta1RegexMapOptions{
		Result: *NewNotebookValueMappingResult(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1RegexMapOptions.
func (NotebookV2beta1RegexMapOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1RegexMapOptions"
}

// +k8s:openapi-gen=true
type NotebookV2beta1SpecialValueMapOptions struct {
	// Special value to match against
	Match NotebookSpecialValueMatch `json:"match"`
	// Config to apply when the value matches the special value
	Result NotebookValueMappingResult `json:"result"`
}

// NewNotebookV2beta1SpecialValueMapOptions creates a new NotebookV2beta1SpecialValueMapOptions object.
func NewNotebookV2beta1SpecialValueMapOptions() *NotebookV2beta1SpecialValueMapOptions {
	return &NotebookV2beta1SpecialValueMapOptions{
		Result: *NewNotebookValueMappingResult(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1SpecialValueMapOptions.
func (NotebookV2beta1SpecialValueMapOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1SpecialValueMapOptions"
}

// +k8s:openapi-gen=true
type NotebookV2beta1ActionStyle struct {
	BackgroundColor *string `json:"backgroundColor,omitempty"`
}

// NewNotebookV2beta1ActionStyle creates a new NotebookV2beta1ActionStyle object.
func NewNotebookV2beta1ActionStyle() *NotebookV2beta1ActionStyle {
	return &NotebookV2beta1ActionStyle{}
}

// OpenAPIModelName returns the OpenAPI model name for NotebookV2beta1ActionStyle.
func (NotebookV2beta1ActionStyle) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookV2beta1ActionStyle"
}

// +k8s:openapi-gen=true
type NotebookTimeSettingsSpecWeekStart string

const (
	NotebookTimeSettingsSpecWeekStartSaturday NotebookTimeSettingsSpecWeekStart = "saturday"
	NotebookTimeSettingsSpecWeekStartMonday   NotebookTimeSettingsSpecWeekStart = "monday"
	NotebookTimeSettingsSpecWeekStartSunday   NotebookTimeSettingsSpecWeekStart = "sunday"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookTimeSettingsSpecWeekStart.
func (NotebookTimeSettingsSpecWeekStart) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookTimeSettingsSpecWeekStart"
}

// +k8s:openapi-gen=true
type NotebookNotebookLayoutItemSpecSource string

const (
	NotebookNotebookLayoutItemSpecSourceAssistant NotebookNotebookLayoutItemSpecSource = "assistant"
	NotebookNotebookLayoutItemSpecSourceUser      NotebookNotebookLayoutItemSpecSource = "user"
)

// OpenAPIModelName returns the OpenAPI model name for NotebookNotebookLayoutItemSpecSource.
func (NotebookNotebookLayoutItemSpecSource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookNotebookLayoutItemSpecSource"
}

// +k8s:openapi-gen=true
type NotebookCellKindOrPanelKindOrLibraryPanelKind struct {
	CellKind         *NotebookCellKind         `json:"CellKind,omitempty"`
	PanelKind        *NotebookPanelKind        `json:"PanelKind,omitempty"`
	LibraryPanelKind *NotebookLibraryPanelKind `json:"LibraryPanelKind,omitempty"`
}

// NewNotebookCellKindOrPanelKindOrLibraryPanelKind creates a new NotebookCellKindOrPanelKindOrLibraryPanelKind object.
func NewNotebookCellKindOrPanelKindOrLibraryPanelKind() *NotebookCellKindOrPanelKindOrLibraryPanelKind {
	return &NotebookCellKindOrPanelKindOrLibraryPanelKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `NotebookCellKindOrPanelKindOrLibraryPanelKind` as JSON.
func (resource NotebookCellKindOrPanelKindOrLibraryPanelKind) MarshalJSON() ([]byte, error) {
	if resource.CellKind != nil {
		return json.Marshal(resource.CellKind)
	}
	if resource.PanelKind != nil {
		return json.Marshal(resource.PanelKind)
	}
	if resource.LibraryPanelKind != nil {
		return json.Marshal(resource.LibraryPanelKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `NotebookCellKindOrPanelKindOrLibraryPanelKind` from JSON.
func (resource *NotebookCellKindOrPanelKindOrLibraryPanelKind) UnmarshalJSON(raw []byte) error {
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
	case "Cell":
		var notebookCellKind NotebookCellKind
		if err := json.Unmarshal(raw, &notebookCellKind); err != nil {
			return err
		}

		resource.CellKind = &notebookCellKind
		return nil
	case "LibraryPanel":
		var notebookLibraryPanelKind NotebookLibraryPanelKind
		if err := json.Unmarshal(raw, &notebookLibraryPanelKind); err != nil {
			return err
		}

		resource.LibraryPanelKind = &notebookLibraryPanelKind
		return nil
	case "Panel":
		var notebookPanelKind NotebookPanelKind
		if err := json.Unmarshal(raw, &notebookPanelKind); err != nil {
			return err
		}

		resource.PanelKind = &notebookPanelKind
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for NotebookCellKindOrPanelKindOrLibraryPanelKind.
func (NotebookCellKindOrPanelKindOrLibraryPanelKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookCellKindOrPanelKindOrLibraryPanelKind"
}

// +k8s:openapi-gen=true
type NotebookMarkdownCellContentKindOrCodeCellContentKind struct {
	MarkdownCellContentKind *NotebookMarkdownCellContentKind `json:"MarkdownCellContentKind,omitempty"`
	CodeCellContentKind     *NotebookCodeCellContentKind     `json:"CodeCellContentKind,omitempty"`
}

// NewNotebookMarkdownCellContentKindOrCodeCellContentKind creates a new NotebookMarkdownCellContentKindOrCodeCellContentKind object.
func NewNotebookMarkdownCellContentKindOrCodeCellContentKind() *NotebookMarkdownCellContentKindOrCodeCellContentKind {
	return &NotebookMarkdownCellContentKindOrCodeCellContentKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `NotebookMarkdownCellContentKindOrCodeCellContentKind` as JSON.
func (resource NotebookMarkdownCellContentKindOrCodeCellContentKind) MarshalJSON() ([]byte, error) {
	if resource.MarkdownCellContentKind != nil {
		return json.Marshal(resource.MarkdownCellContentKind)
	}
	if resource.CodeCellContentKind != nil {
		return json.Marshal(resource.CodeCellContentKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `NotebookMarkdownCellContentKindOrCodeCellContentKind` from JSON.
func (resource *NotebookMarkdownCellContentKindOrCodeCellContentKind) UnmarshalJSON(raw []byte) error {
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
	case "Code":
		var notebookCodeCellContentKind NotebookCodeCellContentKind
		if err := json.Unmarshal(raw, &notebookCodeCellContentKind); err != nil {
			return err
		}

		resource.CodeCellContentKind = &notebookCodeCellContentKind
		return nil
	case "Markdown":
		var notebookMarkdownCellContentKind NotebookMarkdownCellContentKind
		if err := json.Unmarshal(raw, &notebookMarkdownCellContentKind); err != nil {
			return err
		}

		resource.MarkdownCellContentKind = &notebookMarkdownCellContentKind
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for NotebookMarkdownCellContentKindOrCodeCellContentKind.
func (NotebookMarkdownCellContentKindOrCodeCellContentKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookMarkdownCellContentKindOrCodeCellContentKind"
}

// +k8s:openapi-gen=true
type NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap struct {
	ValueMap        *NotebookValueMap        `json:"ValueMap,omitempty"`
	RangeMap        *NotebookRangeMap        `json:"RangeMap,omitempty"`
	RegexMap        *NotebookRegexMap        `json:"RegexMap,omitempty"`
	SpecialValueMap *NotebookSpecialValueMap `json:"SpecialValueMap,omitempty"`
}

// NewNotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap creates a new NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap object.
func NewNotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap() *NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap {
	return &NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap` as JSON.
func (resource NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap) MarshalJSON() ([]byte, error) {
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

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap` from JSON.
func (resource *NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap) UnmarshalJSON(raw []byte) error {
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
		var notebookRangeMap NotebookRangeMap
		if err := json.Unmarshal(raw, &notebookRangeMap); err != nil {
			return err
		}

		resource.RangeMap = &notebookRangeMap
		return nil
	case "regex":
		var notebookRegexMap NotebookRegexMap
		if err := json.Unmarshal(raw, &notebookRegexMap); err != nil {
			return err
		}

		resource.RegexMap = &notebookRegexMap
		return nil
	case "special":
		var notebookSpecialValueMap NotebookSpecialValueMap
		if err := json.Unmarshal(raw, &notebookSpecialValueMap); err != nil {
			return err
		}

		resource.SpecialValueMap = &notebookSpecialValueMap
		return nil
	case "value":
		var notebookValueMap NotebookValueMap
		if err := json.Unmarshal(raw, &notebookValueMap); err != nil {
			return err
		}

		resource.ValueMap = &notebookValueMap
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap.
func (NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.NotebookValueMapOrRangeMapOrRegexMapOrSpecialValueMap"
}

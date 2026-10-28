// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

// +k8s:openapi-gen=true
type DashboardPreferencesDashboardDefaults struct {
	Preload *bool `json:"preload,omitempty"`
	// An empty string turns auto refresh off.
	AutoRefresh          *string                                                `json:"autoRefresh,omitempty"`
	AutoRefreshIntervals []string                                               `json:"autoRefreshIntervals,omitempty"`
	TimeRange            *DashboardPreferencesV2beta1DashboardDefaultsTimeRange `json:"timeRange,omitempty"`
	// 0 is January.
	FiscalYearStartMonth *int64  `json:"fiscalYearStartMonth,omitempty"`
	NowDelay             *string `json:"nowDelay,omitempty"`
	HideTimepicker       *bool   `json:"hideTimepicker,omitempty"`
	// Same values as the dashboard's cursorSync.
	CursorSync *DashboardPreferencesDashboardDefaultsCursorSync `json:"cursorSync,omitempty"`
	Layout     *DashboardPreferencesDashboardDefaultsLayout     `json:"layout,omitempty"`
	// Applies only when the merged layout is AutoGridLayout.
	AutoGrid *DashboardPreferencesV2beta1DashboardDefaultsAutoGrid `json:"autoGrid,omitempty"`
}

// NewDashboardPreferencesDashboardDefaults creates a new DashboardPreferencesDashboardDefaults object.
func NewDashboardPreferencesDashboardDefaults() *DashboardPreferencesDashboardDefaults {
	return &DashboardPreferencesDashboardDefaults{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesDashboardDefaults.
func (DashboardPreferencesDashboardDefaults) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesDashboardDefaults"
}

// Names and values follow Grafana's shared visualization options. Each value is written only into
// new built-in panels whose plugin has that option.
// +k8s:openapi-gen=true
type DashboardPreferencesPanelDefaults struct {
	Legend  *DashboardPreferencesV2beta1PanelDefaultsLegend  `json:"legend,omitempty"`
	Tooltip *DashboardPreferencesV2beta1PanelDefaultsTooltip `json:"tooltip,omitempty"`
	Axis    *DashboardPreferencesV2beta1PanelDefaultsAxis    `json:"axis,omitempty"`
	// Time series, trend and candlestick only.
	Graph *DashboardPreferencesV2beta1PanelDefaultsGraph `json:"graph,omitempty"`
	Field *DashboardPreferencesV2beta1PanelDefaultsField `json:"field,omitempty"`
	Frame *DashboardPreferencesV2beta1PanelDefaultsFrame `json:"frame,omitempty"`
}

// NewDashboardPreferencesPanelDefaults creates a new DashboardPreferencesPanelDefaults object.
func NewDashboardPreferencesPanelDefaults() *DashboardPreferencesPanelDefaults {
	return &DashboardPreferencesPanelDefaults{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesPanelDefaults.
func (DashboardPreferencesPanelDefaults) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesPanelDefaults"
}

// +k8s:openapi-gen=true
type DashboardPreferencesSpec struct {
	// Owner of a user tier object ("user-<userUID>"). Unset on org and folder objects.
	UserUID   *string                                `json:"userUID,omitempty"`
	Dashboard *DashboardPreferencesDashboardDefaults `json:"dashboard,omitempty"`
	Panels    *DashboardPreferencesPanelDefaults     `json:"panels,omitempty"`
}

// NewDashboardPreferencesSpec creates a new DashboardPreferencesSpec object.
func NewDashboardPreferencesSpec() *DashboardPreferencesSpec {
	return &DashboardPreferencesSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesSpec.
func (DashboardPreferencesSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesSpec"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1DashboardDefaultsTimeRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// NewDashboardPreferencesV2beta1DashboardDefaultsTimeRange creates a new DashboardPreferencesV2beta1DashboardDefaultsTimeRange object.
func NewDashboardPreferencesV2beta1DashboardDefaultsTimeRange() *DashboardPreferencesV2beta1DashboardDefaultsTimeRange {
	return &DashboardPreferencesV2beta1DashboardDefaultsTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1DashboardDefaultsTimeRange.
func (DashboardPreferencesV2beta1DashboardDefaultsTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1DashboardDefaultsTimeRange"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1DashboardDefaultsAutoGrid struct {
	MaxColumnCount  *int64                                                               `json:"maxColumnCount,omitempty"`
	ColumnWidthMode *DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode `json:"columnWidthMode,omitempty"`
	// Pixels; used when columnWidthMode is custom.
	ColumnWidth   *int64                                                             `json:"columnWidth,omitempty"`
	RowHeightMode *DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode `json:"rowHeightMode,omitempty"`
	// Pixels; used when rowHeightMode is custom.
	RowHeight  *int64 `json:"rowHeight,omitempty"`
	FillScreen *bool  `json:"fillScreen,omitempty"`
}

// NewDashboardPreferencesV2beta1DashboardDefaultsAutoGrid creates a new DashboardPreferencesV2beta1DashboardDefaultsAutoGrid object.
func NewDashboardPreferencesV2beta1DashboardDefaultsAutoGrid() *DashboardPreferencesV2beta1DashboardDefaultsAutoGrid {
	return &DashboardPreferencesV2beta1DashboardDefaultsAutoGrid{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1DashboardDefaultsAutoGrid.
func (DashboardPreferencesV2beta1DashboardDefaultsAutoGrid) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGrid"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsLegend struct {
	ShowLegend  *bool                                                      `json:"showLegend,omitempty"`
	Placement   *DashboardPreferencesV2beta1PanelDefaultsLegendPlacement   `json:"placement,omitempty"`
	DisplayMode *DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode `json:"displayMode,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsLegend creates a new DashboardPreferencesV2beta1PanelDefaultsLegend object.
func NewDashboardPreferencesV2beta1PanelDefaultsLegend() *DashboardPreferencesV2beta1PanelDefaultsLegend {
	return &DashboardPreferencesV2beta1PanelDefaultsLegend{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsLegend.
func (DashboardPreferencesV2beta1PanelDefaultsLegend) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsLegend"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsTooltip struct {
	Mode      *DashboardPreferencesV2beta1PanelDefaultsTooltipMode `json:"mode,omitempty"`
	Sort      *DashboardPreferencesV2beta1PanelDefaultsTooltipSort `json:"sort,omitempty"`
	HideZeros *bool                                                `json:"hideZeros,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsTooltip creates a new DashboardPreferencesV2beta1PanelDefaultsTooltip object.
func NewDashboardPreferencesV2beta1PanelDefaultsTooltip() *DashboardPreferencesV2beta1PanelDefaultsTooltip {
	return &DashboardPreferencesV2beta1PanelDefaultsTooltip{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsTooltip.
func (DashboardPreferencesV2beta1PanelDefaultsTooltip) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsTooltip"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsAxis struct {
	AxisPlacement    *DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement `json:"axisPlacement,omitempty"`
	AxisGridShow     *bool                                                      `json:"axisGridShow,omitempty"`
	AxisBorderShow   *bool                                                      `json:"axisBorderShow,omitempty"`
	AxisCenteredZero *bool                                                      `json:"axisCenteredZero,omitempty"`
	Scale            *DashboardPreferencesV2beta1PanelDefaultsAxisScale         `json:"scale,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsAxis creates a new DashboardPreferencesV2beta1PanelDefaultsAxis object.
func NewDashboardPreferencesV2beta1PanelDefaultsAxis() *DashboardPreferencesV2beta1PanelDefaultsAxis {
	return &DashboardPreferencesV2beta1PanelDefaultsAxis{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsAxis.
func (DashboardPreferencesV2beta1PanelDefaultsAxis) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsAxis"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsGraph struct {
	LineInterpolation *DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation `json:"lineInterpolation,omitempty"`
	LineWidth         *int64                                                          `json:"lineWidth,omitempty"`
	FillOpacity       *int64                                                          `json:"fillOpacity,omitempty"`
	GradientMode      *DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode      `json:"gradientMode,omitempty"`
	ShowPoints        *DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints        `json:"showPoints,omitempty"`
	PointSize         *int64                                                          `json:"pointSize,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsGraph creates a new DashboardPreferencesV2beta1PanelDefaultsGraph object.
func NewDashboardPreferencesV2beta1PanelDefaultsGraph() *DashboardPreferencesV2beta1PanelDefaultsGraph {
	return &DashboardPreferencesV2beta1PanelDefaultsGraph{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsGraph.
func (DashboardPreferencesV2beta1PanelDefaultsGraph) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsGraph"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsField struct {
	// Number of decimal places, 0 to 15.
	Decimals *int64 `json:"decimals,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsField creates a new DashboardPreferencesV2beta1PanelDefaultsField object.
func NewDashboardPreferencesV2beta1PanelDefaultsField() *DashboardPreferencesV2beta1PanelDefaultsField {
	return &DashboardPreferencesV2beta1PanelDefaultsField{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsField.
func (DashboardPreferencesV2beta1PanelDefaultsField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsField"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsFrame struct {
	Transparent *bool `json:"transparent,omitempty"`
}

// NewDashboardPreferencesV2beta1PanelDefaultsFrame creates a new DashboardPreferencesV2beta1PanelDefaultsFrame object.
func NewDashboardPreferencesV2beta1PanelDefaultsFrame() *DashboardPreferencesV2beta1PanelDefaultsFrame {
	return &DashboardPreferencesV2beta1PanelDefaultsFrame{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsFrame.
func (DashboardPreferencesV2beta1PanelDefaultsFrame) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsFrame"
}

// +k8s:openapi-gen=true
type DashboardPreferencesDashboardDefaultsCursorSync string

const (
	DashboardPreferencesDashboardDefaultsCursorSyncOff       DashboardPreferencesDashboardDefaultsCursorSync = "Off"
	DashboardPreferencesDashboardDefaultsCursorSyncCrosshair DashboardPreferencesDashboardDefaultsCursorSync = "Crosshair"
	DashboardPreferencesDashboardDefaultsCursorSyncTooltip   DashboardPreferencesDashboardDefaultsCursorSync = "Tooltip"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesDashboardDefaultsCursorSync.
func (DashboardPreferencesDashboardDefaultsCursorSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesDashboardDefaultsCursorSync"
}

// +k8s:openapi-gen=true
type DashboardPreferencesDashboardDefaultsLayout string

const (
	DashboardPreferencesDashboardDefaultsLayoutGridLayout     DashboardPreferencesDashboardDefaultsLayout = "GridLayout"
	DashboardPreferencesDashboardDefaultsLayoutAutoGridLayout DashboardPreferencesDashboardDefaultsLayout = "AutoGridLayout"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesDashboardDefaultsLayout.
func (DashboardPreferencesDashboardDefaultsLayout) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesDashboardDefaultsLayout"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode string

const (
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthModeNarrow   DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode = "narrow"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthModeStandard DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode = "standard"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthModeWide     DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode = "wide"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthModeCustom   DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode = "custom"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode.
func (DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGridColumnWidthMode"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode string

const (
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightModeShort    DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode = "short"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightModeStandard DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode = "standard"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightModeTall     DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode = "tall"
	DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightModeCustom   DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode = "custom"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode.
func (DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGridRowHeightMode"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsLegendPlacement string

const (
	DashboardPreferencesV2beta1PanelDefaultsLegendPlacementBottom DashboardPreferencesV2beta1PanelDefaultsLegendPlacement = "bottom"
	DashboardPreferencesV2beta1PanelDefaultsLegendPlacementRight  DashboardPreferencesV2beta1PanelDefaultsLegendPlacement = "right"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsLegendPlacement.
func (DashboardPreferencesV2beta1PanelDefaultsLegendPlacement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsLegendPlacement"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode string

const (
	DashboardPreferencesV2beta1PanelDefaultsLegendDisplayModeList  DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode = "list"
	DashboardPreferencesV2beta1PanelDefaultsLegendDisplayModeTable DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode = "table"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode.
func (DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsLegendDisplayMode"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsTooltipMode string

const (
	DashboardPreferencesV2beta1PanelDefaultsTooltipModeSingle DashboardPreferencesV2beta1PanelDefaultsTooltipMode = "single"
	DashboardPreferencesV2beta1PanelDefaultsTooltipModeMulti  DashboardPreferencesV2beta1PanelDefaultsTooltipMode = "multi"
	DashboardPreferencesV2beta1PanelDefaultsTooltipModeNone   DashboardPreferencesV2beta1PanelDefaultsTooltipMode = "none"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsTooltipMode.
func (DashboardPreferencesV2beta1PanelDefaultsTooltipMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsTooltipMode"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsTooltipSort string

const (
	DashboardPreferencesV2beta1PanelDefaultsTooltipSortNone DashboardPreferencesV2beta1PanelDefaultsTooltipSort = "none"
	DashboardPreferencesV2beta1PanelDefaultsTooltipSortAsc  DashboardPreferencesV2beta1PanelDefaultsTooltipSort = "asc"
	DashboardPreferencesV2beta1PanelDefaultsTooltipSortDesc DashboardPreferencesV2beta1PanelDefaultsTooltipSort = "desc"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsTooltipSort.
func (DashboardPreferencesV2beta1PanelDefaultsTooltipSort) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsTooltipSort"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement string

const (
	DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacementAuto   DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement = "auto"
	DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacementLeft   DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement = "left"
	DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacementRight  DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement = "right"
	DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacementHidden DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement = "hidden"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement.
func (DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsAxisAxisPlacement"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsAxisScale string

const (
	DashboardPreferencesV2beta1PanelDefaultsAxisScaleLinear DashboardPreferencesV2beta1PanelDefaultsAxisScale = "linear"
	DashboardPreferencesV2beta1PanelDefaultsAxisScaleLog2   DashboardPreferencesV2beta1PanelDefaultsAxisScale = "log2"
	DashboardPreferencesV2beta1PanelDefaultsAxisScaleLog10  DashboardPreferencesV2beta1PanelDefaultsAxisScale = "log10"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsAxisScale.
func (DashboardPreferencesV2beta1PanelDefaultsAxisScale) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsAxisScale"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation string

const (
	DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolationLinear     DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation = "linear"
	DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolationSmooth     DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation = "smooth"
	DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolationStepBefore DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation = "stepBefore"
	DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolationStepAfter  DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation = "stepAfter"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation.
func (DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsGraphLineInterpolation"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode string

const (
	DashboardPreferencesV2beta1PanelDefaultsGraphGradientModeNone    DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode = "none"
	DashboardPreferencesV2beta1PanelDefaultsGraphGradientModeOpacity DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode = "opacity"
	DashboardPreferencesV2beta1PanelDefaultsGraphGradientModeHue     DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode = "hue"
	DashboardPreferencesV2beta1PanelDefaultsGraphGradientModeScheme  DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode = "scheme"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode.
func (DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsGraphGradientMode"
}

// +k8s:openapi-gen=true
type DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints string

const (
	DashboardPreferencesV2beta1PanelDefaultsGraphShowPointsAuto   DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints = "auto"
	DashboardPreferencesV2beta1PanelDefaultsGraphShowPointsAlways DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints = "always"
	DashboardPreferencesV2beta1PanelDefaultsGraphShowPointsNever  DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints = "never"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints.
func (DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesV2beta1PanelDefaultsGraphShowPoints"
}

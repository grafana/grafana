// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

// +k8s:openapi-gen=true
type DashboardPreferencesDashboardDefaults struct {
	Preload *bool `json:"preload,omitempty"`
	// An empty string turns auto refresh off.
	AutoRefresh          *string                                                `json:"autoRefresh,omitempty"`
	AutoRefreshIntervals []string                                               `json:"autoRefreshIntervals,omitempty"`
	TimeRange            *DashboardPreferencesV2beta1DashboardDefaultsTimeRange `json:"timeRange,omitempty"`
	// Same values as the dashboard's cursorSync.
	CursorSync *DashboardPreferencesDashboardDefaultsCursorSync `json:"cursorSync,omitempty"`
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
	Field   *DashboardPreferencesV2beta1PanelDefaultsField   `json:"field,omitempty"`
}

// NewDashboardPreferencesPanelDefaults creates a new DashboardPreferencesPanelDefaults object.
func NewDashboardPreferencesPanelDefaults() *DashboardPreferencesPanelDefaults {
	return &DashboardPreferencesPanelDefaults{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesPanelDefaults.
func (DashboardPreferencesPanelDefaults) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesPanelDefaults"
}

// A field of DashboardDefaults or PanelDefaults, by its path from the spec. timeRange is one field
// because from and to are set together.
// +k8s:openapi-gen=true
type DashboardPreferencesResetPath string

const (
	DashboardPreferencesResetPathDashboardPreload              DashboardPreferencesResetPath = "dashboard.preload"
	DashboardPreferencesResetPathDashboardAutoRefresh          DashboardPreferencesResetPath = "dashboard.autoRefresh"
	DashboardPreferencesResetPathDashboardAutoRefreshIntervals DashboardPreferencesResetPath = "dashboard.autoRefreshIntervals"
	DashboardPreferencesResetPathDashboardTimeRange            DashboardPreferencesResetPath = "dashboard.timeRange"
	DashboardPreferencesResetPathDashboardCursorSync           DashboardPreferencesResetPath = "dashboard.cursorSync"
	DashboardPreferencesResetPathPanelsLegendShowLegend        DashboardPreferencesResetPath = "panels.legend.showLegend"
	DashboardPreferencesResetPathPanelsLegendPlacement         DashboardPreferencesResetPath = "panels.legend.placement"
	DashboardPreferencesResetPathPanelsLegendDisplayMode       DashboardPreferencesResetPath = "panels.legend.displayMode"
	DashboardPreferencesResetPathPanelsTooltipMode             DashboardPreferencesResetPath = "panels.tooltip.mode"
	DashboardPreferencesResetPathPanelsTooltipSort             DashboardPreferencesResetPath = "panels.tooltip.sort"
	DashboardPreferencesResetPathPanelsTooltipHideZeros        DashboardPreferencesResetPath = "panels.tooltip.hideZeros"
	DashboardPreferencesResetPathPanelsFieldDecimals           DashboardPreferencesResetPath = "panels.field.decimals"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferencesResetPath.
func (DashboardPreferencesResetPath) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesResetPath"
}

// +k8s:openapi-gen=true
type DashboardPreferencesSpec struct {
	Dashboard *DashboardPreferencesDashboardDefaults `json:"dashboard,omitempty"`
	Panels    *DashboardPreferencesPanelDefaults     `json:"panels,omitempty"`
	// Fields that use Grafana's built-in default at this tier instead of inheriting from the next tier.
	// A built-in default can't always be written as a value: decimals defaults to auto, and panel
	// defaults differ by plugin. A field must not be both set and reset in one tier, or listed twice.
	Reset []DashboardPreferencesResetPath `json:"reset,omitempty"`
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

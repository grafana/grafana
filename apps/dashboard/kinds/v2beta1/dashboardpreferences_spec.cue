package v2beta1

import (
	"list"
	"strings"
)

// Nothing here has a CUE default or references dashboard_spec.cue or the shared viz types, because
// the generated Go New*() and TS default*() constructors would write those defaults into new objects.
// Every member is optional, so a merge-patch sets or clears one leaf at a time. reset is the exception:
// a merge-patch replaces the whole list.
// Numbers are integers within the limits of the editor that sets the same option on a dashboard or
// panel. The dashboard and panel schemas accept any number, so a value copied from a dashboard has to
// be checked against these limits before it is written here.

// Defaults for new dashboards and panels at one tier: org, folder or user. Every field is optional; an absent field inherits from the next tier.
DashboardPreferencesSpec: {
	dashboard?: DashboardDefaults
	panels?:    PanelDefaults
	// Fields that use Grafana's built-in default at this tier instead of inheriting from the next tier.
	// A built-in default can't always be written as a value: decimals defaults to auto, and panel
	// defaults differ by plugin. A field must not be both set and reset in one tier, or listed twice.
	reset?: [...ResetPath] & list.MaxItems(64)
}

// A field of DashboardDefaults or PanelDefaults, by its path from the spec. timeRange is one field
// because from and to are set together.
ResetPath: "dashboard.preload" |
	"dashboard.autoRefresh" |
	"dashboard.autoRefreshIntervals" |
	"dashboard.timeRange" |
	"dashboard.fiscalYearStartMonth" |
	"dashboard.nowDelay" |
	"dashboard.hideTimepicker" |
	"dashboard.cursorSync" |
	"dashboard.layout" |
	"dashboard.autoGrid.maxColumnCount" |
	"dashboard.autoGrid.columnWidthMode" |
	"dashboard.autoGrid.columnWidth" |
	"dashboard.autoGrid.rowHeightMode" |
	"dashboard.autoGrid.rowHeight" |
	"dashboard.autoGrid.fillScreen" |
	"panels.legend.showLegend" |
	"panels.legend.placement" |
	"panels.legend.displayMode" |
	"panels.tooltip.mode" |
	"panels.tooltip.sort" |
	"panels.tooltip.hideZeros" |
	"panels.axis.axisPlacement" |
	"panels.axis.axisGridShow" |
	"panels.axis.axisBorderShow" |
	"panels.axis.axisCenteredZero" |
	"panels.axis.scale" |
	"panels.graph.lineInterpolation" |
	"panels.graph.lineWidth" |
	"panels.graph.fillOpacity" |
	"panels.graph.gradientMode" |
	"panels.graph.showPoints" |
	"panels.graph.pointSize" |
	"panels.field.decimals" |
	"panels.frame.transparent"

DashboardDefaults: {
	preload?: bool
	// An empty string turns auto refresh off.
	autoRefresh?: string & strings.MaxRunes(32)
	autoRefreshIntervals?: [...string & strings.MinRunes(1) & strings.MaxRunes(32)] & list.MaxItems(30)
	timeRange?: {
		from: string & strings.MinRunes(1) & strings.MaxRunes(64)
		to:   string & strings.MinRunes(1) & strings.MaxRunes(64)
	}
	// 0 is January.
	fiscalYearStartMonth?: int & >-1 & <=11
	nowDelay?:             string & strings.MinRunes(1) & strings.MaxRunes(32)
	hideTimepicker?:       bool
	// Same values as the dashboard's cursorSync.
	cursorSync?: "Off" | "Crosshair" | "Tooltip"
	layout?:     "GridLayout" | "AutoGridLayout"
	// Applies only when the merged layout is AutoGridLayout.
	autoGrid?: {
		maxColumnCount?:  int & >-1 & <=10
		columnWidthMode?: "narrow" | "standard" | "wide" | "custom"
		// Pixels; used when columnWidthMode is custom.
		columnWidth?:   int & >-1 & <=2000
		rowHeightMode?: "short" | "standard" | "tall" | "custom"
		// Pixels; used when rowHeightMode is custom.
		rowHeight?:  int & >-1 & <=2000
		fillScreen?: bool
	}
}

// Names and values follow Grafana's shared visualization options. Each value is written only into
// new built-in panels whose plugin has that option.
PanelDefaults: {
	legend?: {
		showLegend?:  bool
		placement?:   "bottom" | "right"
		displayMode?: "list" | "table"
	}
	tooltip?: {
		mode?:      "single" | "multi" | "none"
		sort?:      "none" | "asc" | "desc"
		hideZeros?: bool
	}
	axis?: {
		axisPlacement?:    "auto" | "left" | "right" | "hidden"
		axisGridShow?:     bool
		axisBorderShow?:   bool
		axisCenteredZero?: bool
		scale?:            "linear" | "log2" | "log10"
	}
	// Time series, trend and candlestick only.
	graph?: {
		lineInterpolation?: "linear" | "smooth" | "stepBefore" | "stepAfter"
		lineWidth?:         int & >-1 & <=10
		fillOpacity?:       int & >-1 & <=100
		gradientMode?:      "none" | "opacity" | "hue" | "scheme"
		showPoints?:        "auto" | "always" | "never"
		pointSize?:         int & >-1 & <=40
	}
	field?: {
		// Number of decimal places, 0 to 15.
		decimals?: int & >-1 & <=15
	}
	frame?: {
		transparent?: bool
	}
}

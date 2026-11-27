// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface DashboardDefaults {
	preload?: boolean;
	// An empty string turns auto refresh off.
	autoRefresh?: string;
	autoRefreshIntervals?: string[];
	timeRange?: {
		from: string;
		to: string;
	};
	// 0 is January.
	fiscalYearStartMonth?: number;
	nowDelay?: string;
	hideTimepicker?: boolean;
	// Same values as the dashboard's cursorSync.
	cursorSync?: "Off" | "Crosshair" | "Tooltip";
	layout?: "GridLayout" | "AutoGridLayout";
	// Applies only when the merged layout is AutoGridLayout.
	autoGrid?: {
		maxColumnCount?: number;
		columnWidthMode?: "narrow" | "standard" | "wide" | "custom";
		// Pixels; used when columnWidthMode is custom.
		columnWidth?: number;
		rowHeightMode?: "short" | "standard" | "tall" | "custom";
		// Pixels; used when rowHeightMode is custom.
		rowHeight?: number;
		fillScreen?: boolean;
	};
}

export const defaultDashboardDefaults = (): DashboardDefaults => ({
});

/**
 * Names and values follow Grafana's shared visualization options. Each value is written only into
 * new built-in panels whose plugin has that option.
 */
export interface PanelDefaults {
	legend?: {
		showLegend?: boolean;
		placement?: "bottom" | "right";
		displayMode?: "list" | "table";
	};
	tooltip?: {
		mode?: "single" | "multi" | "none";
		sort?: "none" | "asc" | "desc";
		hideZeros?: boolean;
	};
	axis?: {
		axisPlacement?: "auto" | "left" | "right" | "hidden";
		axisGridShow?: boolean;
		axisBorderShow?: boolean;
		axisCenteredZero?: boolean;
		scale?: "linear" | "log2" | "log10";
	};
	// Time series, trend and candlestick only.
	graph?: {
		lineInterpolation?: "linear" | "smooth" | "stepBefore" | "stepAfter";
		lineWidth?: number;
		fillOpacity?: number;
		gradientMode?: "none" | "opacity" | "hue" | "scheme";
		showPoints?: "auto" | "always" | "never";
		pointSize?: number;
	};
	field?: {
		// Number of decimal places, 0 to 15.
		decimals?: number;
	};
	frame?: {
		transparent?: boolean;
	};
}

export const defaultPanelDefaults = (): PanelDefaults => ({
});

/**
 * A field of DashboardDefaults or PanelDefaults, by its path from the spec. timeRange is one field
 * because from and to are set together.
 */
export type ResetPath = "dashboard.preload" | "dashboard.autoRefresh" | "dashboard.autoRefreshIntervals" | "dashboard.timeRange" | "dashboard.fiscalYearStartMonth" | "dashboard.nowDelay" | "dashboard.hideTimepicker" | "dashboard.cursorSync" | "dashboard.layout" | "dashboard.autoGrid.maxColumnCount" | "dashboard.autoGrid.columnWidthMode" | "dashboard.autoGrid.columnWidth" | "dashboard.autoGrid.rowHeightMode" | "dashboard.autoGrid.rowHeight" | "dashboard.autoGrid.fillScreen" | "panels.legend.showLegend" | "panels.legend.placement" | "panels.legend.displayMode" | "panels.tooltip.mode" | "panels.tooltip.sort" | "panels.tooltip.hideZeros" | "panels.axis.axisPlacement" | "panels.axis.axisGridShow" | "panels.axis.axisBorderShow" | "panels.axis.axisCenteredZero" | "panels.axis.scale" | "panels.graph.lineInterpolation" | "panels.graph.lineWidth" | "panels.graph.fillOpacity" | "panels.graph.gradientMode" | "panels.graph.showPoints" | "panels.graph.pointSize" | "panels.field.decimals" | "panels.frame.transparent";

export const defaultResetPath = (): ResetPath => ("dashboard.preload");

export interface Spec {
	dashboard?: DashboardDefaults;
	panels?: PanelDefaults;
	// Fields that use Grafana's built-in default at this tier instead of inheriting from the next tier.
	// A built-in default can't always be written as a value: decimals defaults to auto, and panel
	// defaults differ by plugin. A field must not be both set and reset in one tier, or listed twice.
	reset?: ResetPath[];
}

export const defaultSpec = (): Spec => ({
});


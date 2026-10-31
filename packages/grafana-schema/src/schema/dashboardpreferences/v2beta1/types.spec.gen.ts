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

export interface Spec {
	// Owner of a user tier object ("user-<userUID>"). Unset on org and folder objects.
	userUID?: string;
	dashboard?: DashboardDefaults;
	panels?: PanelDefaults;
}

export const defaultSpec = (): Spec => ({
});


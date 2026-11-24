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
	// Same values as the dashboard's cursorSync.
	cursorSync?: "Off" | "Crosshair" | "Tooltip";
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
	field?: {
		// Number of decimal places, 0 to 15.
		decimals?: number;
	};
}

export const defaultPanelDefaults = (): PanelDefaults => ({
});

/**
 * A field of DashboardDefaults or PanelDefaults, by its path from the spec. timeRange is one field
 * because from and to are set together.
 */
export type ResetPath = "dashboard.preload" | "dashboard.autoRefresh" | "dashboard.autoRefreshIntervals" | "dashboard.timeRange" | "dashboard.cursorSync" | "panels.legend.showLegend" | "panels.legend.placement" | "panels.legend.displayMode" | "panels.tooltip.mode" | "panels.tooltip.sort" | "panels.tooltip.hideZeros" | "panels.field.decimals";

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


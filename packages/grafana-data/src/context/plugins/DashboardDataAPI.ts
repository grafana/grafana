/**
 * A tab or row of a dashboard.
 *
 * @alpha
 */
export interface DashboardSectionInfo {
  kind: 'tab' | 'row';
  /** The saved title, uninterpolated. References are built from these, so they survive variable changes. */
  title: string;
  /** The title as the viewer sees it, with variables interpolated. Empty when the section has no title. */
  label: string;
  /** Opaque source reference that resolves to every panel in the section, including panels added later. */
  ref: string;
}

/**
 * The dashboard currently open.
 *
 * @alpha
 */
export interface DashboardInfo {
  /** Unique per visit: opening the same dashboard again gives a new key, so callers can scope state to one visit. */
  instanceKey: string;
  uid?: string;
  title: string;
  description: string;
  /** Absolute URL of the dashboard with the current time range and variables. */
  url: string;
  canEdit: boolean;
  isEditing: boolean;
  /** ISO 8601 timestamps. */
  timeRange: { from: string; to: string };
  /** Interpolated values by variable name. */
  variables: Record<string, string>;
  /** Source reference meaning every panel on the dashboard, including panels added later. */
  allPanelsRef: string;
}

/**
 * A panel whose data can be captured.
 *
 * @alpha
 */
export interface DashboardPanelInfo {
  key: string;
  title: string;
  description: string;
  pluginId: string;
  /** The tabs and rows the panel sits in, outermost first. */
  sections: DashboardSectionInfo[];
  /**
   * The panel reuses another panel's results (the `-- Dashboard --` data source), so time-range and variable
   * captures would report the live data and are refused per panel.
   */
  reusesDashboardQuery: boolean;
  /** Names of the dashboard variables the panel's queries use. A variable capture loads only these panels. */
  variableNames: string[];
}

/** @alpha */
export interface DashboardVariableOption {
  value: string;
  text: string;
}

/**
 * A dashboard variable with a list of values.
 *
 * @alpha
 */
export interface DashboardVariableInfo {
  name: string;
  label?: string;
  /** The selected values, in option order. Empty when All or nothing is selected. */
  selected: DashboardVariableOption[];
  isAll: boolean;
  options: DashboardVariableOption[];
}

/**
 * A source reference that covers no panel.
 *
 * @alpha
 */
export interface DashboardUnavailableSource {
  ref: string;
  /**
   * For a tab or row reference, the saved titles leading to it, outermost first; empty for the every-panel
   * reference. Undefined for a panel key.
   */
  sectionPath?: string[];
}

/** @alpha */
export interface DashboardSourceResolution {
  /** Keys of the panels the references cover now, deduplicated, in reference order. */
  panelKeys: string[];
  /** Removed panels, and tabs or rows that were renamed, removed, or hold no panels. */
  unavailable: DashboardUnavailableSource[];
}

/** @alpha */
export interface DashboardPanelCaptureRequest {
  /** Panel keys and section references. */
  sources: string[];
  /** Run queries for panels that haven't loaded, such as panels in other tabs or collapsed rows. Up to 30 seconds each. */
  load?: boolean;
  /** Capture over another time range without changing the dashboard. */
  timeRange?: { from: string; to: string };
  /** Capture with one variable set to one value. Panels whose queries don't use it report `independent`. */
  variable?: { name: string; value: string };
  signal?: AbortSignal;
}

/**
 * Why a panel's data was or wasn't captured.
 *
 * - `done`: captured.
 * - `missing`: the key is not a panel on the dashboard.
 * - `not-loaded`: the panel hasn't run its query for this range (or didn't finish within the load timeout).
 * - `loading`: its query is running or streaming.
 * - `error`: its query failed; see `error`.
 * - `time-range-mismatch`: the panel shows another time range, for example through a panel time override.
 * - `independent`: a variable capture, and the panel's queries don't use the variable.
 * - `reuses-dashboard-query`: a variant capture of a panel that reuses another panel's results, which would report
 *   the live data rather than the variant.
 *
 * @alpha
 */
export type CapturedPanelStatus =
  | 'done'
  | 'missing'
  | 'not-loaded'
  | 'loading'
  | 'error'
  | 'time-range-mismatch'
  | 'independent'
  | 'reuses-dashboard-query';

/** @alpha */
export interface CapturedField {
  /** Display name, as the viewer sees it. */
  name: string;
  type: string;
  unit?: string;
  labels?: Record<string, string>;
  /** A copy of the field's values. */
  values: unknown[];
}

/** @alpha */
export interface CapturedFrame {
  name?: string;
  fields: CapturedField[];
}

/** @alpha */
export interface CapturedPanel {
  key: string;
  title: string;
  description: string;
  sections: DashboardSectionInfo[];
  status: CapturedPanelStatus;
  error?: string;
  /** Transformations and field overrides applied. Empty unless `status` is `done`. */
  frames: CapturedFrame[];
}

/** @alpha */
export interface CapturedAnnotation {
  /** ISO 8601. */
  time: string;
  /** Set when the annotation is a region. */
  timeEnd?: string;
  title?: string;
  text?: string;
  tags?: string[];
}

/** @alpha */
export interface DashboardPanelCapture {
  /** The range the panels were captured over. */
  timeRange: { from: string; to: string };
  /**
   * Interpolated values by variable name, with a variable capture's value applied. Only the variables the requested
   * panels use: those their titles and queries reference, and ad hoc filters and group by, which apply without a
   * reference. Constants are left out.
   */
  variables: Record<string, string>;
  /** Section references that resolve to no panels. Removed panels are reported as `missing` panels instead. */
  missingRefs: DashboardUnavailableSource[];
  panels: CapturedPanel[];
  /** What the captured panels' annotation layers show within the range, merged across panels. Empty for variant captures. */
  annotations: CapturedAnnotation[];
}

/** @alpha */
export type DashboardDataEvent =
  | {
      type: 'changed';
      /**
       * Keys of the panels whose data or settings changed. Undefined when the change can affect every panel, such
       * as a time range, variable, layout, or dashboard change.
       */
      panelKeys?: string[];
    }
  | { type: 'deactivated'; instanceKey: string };

/**
 * Read-only access to the dashboard currently open, in plain serializable data, for plugins that reason about
 * what a dashboard shows. Shared with allowlisted plugins as the `dashboardDataAPI` restricted API.
 *
 * @alpha
 */
export interface DashboardDataAPI {
  /** Undefined when the current page isn't a scenes dashboard. */
  getDashboard(): DashboardInfo | undefined;
  /** Panels whose data can be captured, in layout order: panels with queries, excluding repeat clones. */
  getPanels(): DashboardPanelInfo[];
  /**
   * Variables whose values are picked from a list of options, such as query, custom, and data source variables.
   * Others, such as interval and text box variables, are left out.
   */
  getVariables(): DashboardVariableInfo[];
  /** Resolves panel keys and section references to the panels they cover now, without reading data. */
  resolveSources(refs: string[]): DashboardSourceResolution;
  /**
   * Captures what the selected panels show. Reports panel problems per panel instead of rejecting; rejects only
   * when no dashboard is open.
   */
  capturePanels(request: DashboardPanelCaptureRequest): Promise<DashboardPanelCapture>;
  /** Switches tab, expands rows, scrolls to the panel, and briefly outlines it. */
  revealPanel(panelKey: string): void;
  /** Explore with the panel's queries over a window, or undefined when the viewer has no Explore access. */
  getExploreUrl(panelKey: string, timeWindow: { from: string; to: string }): Promise<string | undefined>;
  /**
   * Subscribes to the dashboard open now. `changed` fires at most once per animation frame on panel data, time
   * range, variable, filter, layout, edit mode, and save changes; `deactivated` fires when that dashboard is left.
   */
  subscribe(listener: (event: DashboardDataEvent) => void): () => void;
}

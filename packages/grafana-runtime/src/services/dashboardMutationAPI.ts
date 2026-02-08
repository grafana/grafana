/**
 * Dashboard Mutation API Service
 *
 * Provides a stable interface for programmatic dashboard modifications.
 *
 * The API is registered by DashboardScene when a dashboard is loaded and
 * cleared when the dashboard is deactivated.
 *
 * IMPORTANT: This is a singleton -- only one dashboard's API is active at a time.
 * If Grafana supports multiple simultaneous dashboards in the future (e.g., split views),
 * this pattern will need to be replaced with a Map keyed by dashboardUid or sceneId.
 *
 * All types are exported via `DashboardMutationAPI` to minimize
 * the public API surface of @grafana/runtime.
 *
 * @example
 * ```typescript
 * import { DashboardMutationAPI } from '@grafana/runtime';
 *
 * const api = DashboardMutationAPI.getDashboardMutationAPI();
 * if (api) {
 *   const result = await api.execute({ type: 'ADD_PANEL', payload: { ... } });
 * }
 *
 * // Schemas are available as static imports for composition at module load time:
 * const { schemas } = DashboardMutationAPI;
 * const mySchema = schemas.panelKindSchema;
 * ```
 */

/** The input to execute() */
export interface MutationRequest {
  /** Type of mutation (e.g., 'ADD_PANEL', 'REMOVE_PANEL', 'UPDATE_PANEL') */
  type: string;
  /** Payload specific to the mutation type */
  payload: unknown;
}

/** The output from execute() */
export interface MutationResult {
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** List of changes made by the mutation */
  changes?: MutationChange[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Data returned by read-only operations (e.g., GET_DASHBOARD_SETTINGS) */
  data?: unknown;
}

/** Describes a single change made by a mutation */
export interface MutationChange {
  /** JSON path to the changed value */
  path: string;
  /** Value before the change */
  previousValue: unknown;
  /** Value after the change */
  newValue: unknown;
}

/** Response data from GET_DASHBOARD_SETTINGS */
export interface DashboardSettings {
  uid: string | undefined;
  title: string;
  description?: string;
  tags?: string[];
  editable?: boolean;
  preload?: boolean;
  liveNow?: boolean;
  cursorSync?: 'Off' | 'Crosshair' | 'Tooltip';
  links?: DashboardSettingsLink[];
  timeSettings: {
    from?: string;
    to?: string;
    timezone?: string;
    autoRefresh?: string;
  };
  canEdit: boolean;
  isEditing: boolean;
  availableCommands: string[];
}

/** Dashboard link as returned by GET_DASHBOARD_SETTINGS */
export interface DashboardSettingsLink {
  title: string;
  type: string;
  url?: string;
  icon?: string;
  tooltip?: string;
  tags?: string[];
  asDropdown?: boolean;
  targetBlank?: boolean;
  includeVars?: boolean;
  keepTime?: boolean;
}

/**
 * The Dashboard Mutation API client interface.
 *
 * Common mutation types:
 * - GET_DASHBOARD_SETTINGS: Get dashboard state and all settings
 * - ENTER_EDIT_MODE: Enter edit mode
 * - ADD_PANEL, REMOVE_PANEL, UPDATE_PANEL: Panel operations
 * - ADD_VARIABLE, REMOVE_VARIABLE: Variable operations
 * - UPDATE_DASHBOARD_SETTINGS: Update title, description, tags, time settings
 */
export interface MutationClient {
  /** UID of the dashboard this client is bound to. Use to verify the target dashboard. */
  readonly uid: string | undefined;

  /** Execute a mutation on the dashboard. */
  execute(mutation: MutationRequest): Promise<MutationResult>;
}

// Singleton instance
let _dashboardMutationAPI: MutationClient | null = null;

// Expose on window for cross-bundle access (plugins use different bundle)
declare global {
  interface Window {
    __grafanaDashboardMutationAPI?: MutationClient | null;
  }
}

/**
 * Set the dashboard mutation API instance.
 * Called by DashboardScene when a dashboard is activated.
 *
 * @param api - The mutation API instance, or null to clear
 * @internal
 */
export function setDashboardMutationAPI(api: MutationClient | null): void {
  _dashboardMutationAPI = api;
  // Also expose on window for plugins that use a different @grafana/runtime bundle
  if (typeof window !== 'undefined') {
    window.__grafanaDashboardMutationAPI = api;
  }
}

/**
 * Get the dashboard mutation API for the currently loaded dashboard.
 *
 * @returns The mutation API, or null if no dashboard is loaded
 */
export function getDashboardMutationAPI(): MutationClient | null {
  if (_dashboardMutationAPI) {
    return _dashboardMutationAPI;
  }
  // Fallback to window for cross-bundle access (plugins use different bundle)
  if (typeof window !== 'undefined' && window.__grafanaDashboardMutationAPI) {
    return window.__grafanaDashboardMutationAPI;
  }
  return null;
}

/**
 * Canonical Zod schemas for v2beta1 dashboard structures.
 *
 * Available as static imports so consumers can compose tool schemas
 * at module load time, before any dashboard is loaded.
 */
// eslint-disable-next-line no-restricted-imports -- cross-package re-export for the public API surface
export * as schemas from '../../../../public/app/features/dashboard-scene/mutation-api/commands/schemas';

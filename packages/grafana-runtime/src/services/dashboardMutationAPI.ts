/**
 * Dashboard Mutation API Service
 *
 * Provides a stable interface for programmatic dashboard modifications.
 *
 * The API is registered by DashboardScene when a dashboard is loaded and
 * cleared when the dashboard is deactivated.
 */

/**
 * MCP Tool Definition - describes a tool that can be invoked
 * @see https://spec.modelcontextprotocol.io/specification/server/tools/
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    confirmationHint?: boolean;
  };
}

export interface MutationResult {
  success: boolean;
  /** ID of the affected panel (for panel operations) */
  panelId?: string;
  /** Error message if success is false */
  error?: string;
  /** List of changes made by the mutation */
  changes?: MutationChange[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Data returned by read-only operations (e.g., GET_DASHBOARD_INFO) */
  data?: unknown;
}

export interface MutationChange {
  /** JSON path to the changed value */
  path: string;
  /** Value before the change */
  previousValue: unknown;
  /** Value after the change */
  newValue: unknown;
}

export interface MutationRequest {
  /** Type of mutation (e.g., 'ADD_PANEL', 'REMOVE_PANEL', 'UPDATE_PANEL') */
  type: string;
  /** Payload specific to the mutation type */
  payload: unknown;
}

/**
 * Dashboard info returned by getDashboardMutationAPI().getDashboardInfo()
 */
export interface DashboardMutationInfo {
  available: boolean;
  uid?: string;
  title?: string;
  canEdit: boolean;
  isEditing: boolean;
  availableTools: string[];
}

export interface DashboardMutationAPI {
  /**
   * Execute a mutation on the dashboard
   */
  execute(mutation: MutationRequest): Promise<MutationResult>;

  /**
   * Check if the current user can edit the dashboard
   */
  canEdit(): boolean;

  /**
   * Get the UID of the currently loaded dashboard
   */
  getDashboardUID(): string | undefined;

  /**
   * Get the title of the currently loaded dashboard
   */
  getDashboardTitle(): string | undefined;

  /**
   * Check if the dashboard is in edit mode
   */
  isEditing(): boolean;

  /**
   * Enter edit mode if not already editing
   */
  enterEditMode(): void;

  /**
   * Get the available MCP tool definitions for this dashboard
   */
  getTools(): MCPToolDefinition[];

  /**
   * Get comprehensive dashboard info in a single call
   */
  getDashboardInfo(): DashboardMutationInfo;
}

// Singleton instance
let _dashboardMutationAPI: DashboardMutationAPI | null = null;

// Expose on window for cross-bundle access (plugins use different bundle)
declare global {
  interface Window {
    __grafanaDashboardMutationAPI?: DashboardMutationAPI | null;
  }
}

/**
 * Set the dashboard mutation API instance.
 * Called by DashboardScene when a dashboard is activated.
 *
 * @param api - The mutation API instance, or null to clear
 * @internal
 */
export function setDashboardMutationAPI(api: DashboardMutationAPI | null): void {
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
 *
 * @example
 * ```typescript
 * import { getDashboardMutationAPI } from '@grafana/runtime';
 *
 * const api = getDashboardMutationAPI();
 * if (api && api.canEdit()) {
 *   await api.execute({
 *     type: 'ADD_PANEL',
 *     payload: { ... }
 *   });
 * }
 * ```
 */
export function getDashboardMutationAPI(): DashboardMutationAPI | null {
  return _dashboardMutationAPI;
}

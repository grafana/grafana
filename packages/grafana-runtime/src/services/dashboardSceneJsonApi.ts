export interface DashboardSceneJsonApiV2 {
  /**
   * Read the currently open dashboard as v2beta1 Dashboard kind JSON (JSON string).
   */
  getCurrentDashboard(space?: number): string;

  /**
   * Read query errors for the currently open dashboard (JSON string).
   *
   * This returns a JSON array of objects shaped like:
   * `{ panelId, panelTitle, refId?, datasource?, message, severity }`.
   */
  getCurrentDashboardErrors(space?: number): string;

  /**
   * Read current dashboard variables (JSON string).
   *
   * This returns JSON shaped like:
   * `{ variables: [{ name, value }] }`
   * where `value` is `string | string[]`.
   */
  getCurrentDashboardVariables(space?: number): string;

  /**
   * Apply dashboard variable values (JSON string).
   *
   * Accepts either:
   * - `{ variables: [{ name, value }] }`
   * - or a map `{ [name]: value }`
   *
   * where `value` is `string | string[]`.
   */
  applyCurrentDashboardVariables(varsJson: string): void;

  /**
   * Read the current dashboard time range (JSON string).
   *
   * This returns JSON shaped like:
   * `{ from, to, timezone? }`.
   */
  getCurrentDashboardTimeRange(space?: number): string;

  /**
   * Apply the current dashboard time range (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ from, to, timezone? }` where `from/to` are Grafana raw strings (e.g. `now-6h`, `now`).
   */
  applyCurrentDashboardTimeRange(timeRangeJson: string): void;

  /**
   * Select a tab within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ title?: string, slug?: string }`.
   */
  selectCurrentDashboardTab(tabJson: string): void;

  /**
   * Read current in-dashboard navigation state (JSON string).
   *
   * This returns JSON shaped like:
   * `{ tab: { slug: string, title?: string } | null }`.
   */
  getCurrentDashboardNavigation(space?: number): string;

  /**
   * Scroll/focus a row within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ title?: string, rowKey?: string }`.
   */
  focusCurrentDashboardRow(rowJson: string): void;

  /**
   * Scroll/focus a panel within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ panelId: number }`.
   */
  focusCurrentDashboardPanel(panelJson: string): void;

  /**
   * Apply a v2beta1 Dashboard kind JSON (JSON string).
   *
   * Implementations must enforce **spec-only** updates by rejecting any changes to
   * `apiVersion`, `kind`, `metadata`, or `status`.
   */
  applyCurrentDashboard(resourceJson: string): void;
}

let singletonInstance: DashboardSceneJsonApiV2 | undefined;

/**
 * Used during startup by Grafana to register the implementation.
 *
 * @internal
 */
export function setDashboardSceneJsonApiV2(instance: DashboardSceneJsonApiV2) {
  singletonInstance = instance;
}

/**
 * Returns the registered DashboardScene JSON API.
 *
 * @public
 */
export function getDashboardSceneJsonApiV2(): DashboardSceneJsonApiV2 {
  if (!singletonInstance) {
    throw new Error('DashboardScene JSON API is not available');
  }
  return singletonInstance;
}

/**
 * A grouped, ergonomic API wrapper around the DashboardScene JSON API.
 *
 * This is purely a convenience layer: it calls the same underlying registered implementation
 * as the top-level helper functions, but organizes functionality into namespaces like
 * `navigation`, `variables`, and `timeRange`.
 *
 * @public
 */
export function getDashboardApi() {
  const api = getDashboardSceneJsonApiV2();
  return {
    /**
     * Prints/returns a quick reference for the grouped dashboard API, including expected JSON shapes.
     */
    help: () => {
      const text = [
        'Dashboard API (DashboardScene JSON API, schema v2 kinds)',
        '',
        'All inputs/outputs are JSON strings.',
        'Edits are spec-only: apiVersion/kind/metadata/status must not change.',
        '',
        'Read/apply dashboard:',
        '- dashboard.getCurrent(space?): string',
        '- dashboard.apply(resourceJson: string): void',
        '  - resourceJson must be a v2beta1 Dashboard kind object:',
        '    { apiVersion: "dashboard.grafana.app/v2beta1", kind: "Dashboard", metadata: {...}, spec: {...}, status: {...} }',
        '',
        'Errors:',
        '- errors.getCurrent(space?): string',
        '  - returns JSON: { errors: [{ panelId, panelTitle, refId?, datasource?, message, severity }] }',
        '',
        'Variables:',
        '- variables.getCurrent(space?): string',
        '  - returns JSON: { variables: [{ name, value }] } where value is string | string[]',
        '- variables.apply(varsJson: string): void',
        '  - accepts JSON: { variables: [{ name, value }] } OR { [name]: value }',
        '',
        'Time range:',
        '- timeRange.getCurrent(space?): string',
        '  - returns JSON: { from: string, to: string, timezone?: string }',
        '- timeRange.apply(timeRangeJson: string): void',
        '  - accepts JSON: { from: "now-6h", to: "now", timezone?: "browser" | "utc" | ... }',
        '',
        'Navigation:',
        '- navigation.getCurrent(space?): string',
        '  - returns JSON: { tab: { slug: string, title?: string } | null }',
        '- navigation.selectTab(tabJson: string): void',
        '  - accepts JSON: { title?: string, slug?: string }',
        '- navigation.focusRow(rowJson: string): void',
        '  - accepts JSON: { title?: string, rowKey?: string }',
        '- navigation.focusPanel(panelJson: string): void',
        '  - accepts JSON: { panelId: number }',
        '',
        'Examples:',
        '- window.dashboardApi.timeRange.apply(JSON.stringify({ from: "now-6h", to: "now", timezone: "browser" }))',
        '- window.dashboardApi.navigation.selectTab(JSON.stringify({ title: "Overview" }))',
        '- window.dashboardApi.navigation.focusPanel(JSON.stringify({ panelId: 12 }))',
      ].join('\n');

      // Calling help is an explicit action; logging is useful in the browser console.
      // Return the text as well so callers can print/store it as they prefer.
      try {
        // eslint-disable-next-line no-console
        console.log(text);
      } catch {
        // ignore
      }

      return text;
    },
    dashboard: {
      getCurrent: (space = 2) => api.getCurrentDashboard(space),
      apply: (resourceJson: string) => api.applyCurrentDashboard(resourceJson),
    },
    errors: {
      getCurrent: (space = 2) => JSON.stringify({ errors: JSON.parse(api.getCurrentDashboardErrors(space)) }, null, space),
    },
    variables: {
      getCurrent: (space = 2) => api.getCurrentDashboardVariables(space),
      apply: (varsJson: string) => api.applyCurrentDashboardVariables(varsJson),
    },
    timeRange: {
      getCurrent: (space = 2) => api.getCurrentDashboardTimeRange(space),
      apply: (timeRangeJson: string) => api.applyCurrentDashboardTimeRange(timeRangeJson),
    },
    navigation: {
      getCurrent: (space = 2) => api.getCurrentDashboardNavigation(space),
      selectTab: (tabJson: string) => api.selectCurrentDashboardTab(tabJson),
      focusRow: (rowJson: string) => api.focusCurrentDashboardRow(rowJson),
      focusPanel: (panelJson: string) => api.focusCurrentDashboardPanel(panelJson),
    },
  };
}



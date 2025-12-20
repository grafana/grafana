export interface DashboardSceneJsonApiV2 {
  /**
   * Read the currently open dashboard as v2beta1 Dashboard kind JSON (JSON string).
   */
  getCurrentDashboard(space?: number): string;

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
 * Plugin-friendly helper to read the current dashboard as kind JSON (JSON string).
 *
 * @public
 */
export function getCurrentDashboard(space = 2): string {
  return getDashboardSceneJsonApiV2().getCurrentDashboard(space);
}

/**
 * JSON-string helper to apply a v2 Dashboard kind JSON (spec-only enforcement happens in the implementation).
 *
 * @public
 */
export function applyCurrentDashboard(resourceJson: string): void {
  return getDashboardSceneJsonApiV2().applyCurrentDashboard(resourceJson);
}



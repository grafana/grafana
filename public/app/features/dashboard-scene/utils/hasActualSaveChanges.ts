import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

/**
 * Checks if there are save changes but not counting time range, refresh rate and default variable value change
 */
export function hasActualSaveChanges(dashboard: DashboardScene) {
  const changes = dashboard.getDashboardChanges();
  return !!changes.diffCount;
}

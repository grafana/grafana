import { SceneObject, useSceneObjectState } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../utils/utils';

/**
 * Hook to check if a target element or layout item should be hidden
 * based on dashboard-level rules (gated behind dashboardRules feature flag).
 *
 * Returns undefined when no rules target the given key (caller should fall
 * back to per-element conditional rendering or default visibility).
 * Returns true when the target should be hidden, false when it should be shown.
 */
export function useRuleBasedVisibility(sceneObject: SceneObject, targetKey: string): boolean | undefined {
  const dashboard = getDashboardSceneFor(sceneObject);
  const { dashboardRules } = dashboard.useState();

  if (!dashboardRules) {
    return undefined;
  }

  // Subscribe to the hiddenTargets map so the component re-renders when rules change
  const { hiddenTargets } = useSceneObjectState(dashboardRules, { shouldActivateOrKeepAlive: true });

  return hiddenTargets[targetKey];
}

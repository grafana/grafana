import { SceneObject, useSceneObjectState } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardRules } from '../rules/DashboardRules';

/** Singleton placeholder so the hook always calls useSceneObjectState (React rules). */
let placeholderRules: DashboardRules | undefined;
function getPlaceholderRules(): DashboardRules {
  if (!placeholderRules) {
    placeholderRules = new DashboardRules({ rules: [], hiddenTargets: {}, collapsedTargets: {} });
  }
  return placeholderRules;
}

/**
 * Hook to check if a target row should be collapsed or expanded
 * based on dashboard-level rules (gated behind dashboardRules feature flag).
 *
 * Returns undefined when no collapse rule targets the given key (caller should
 * use the row's own collapse state). Returns true when the row should be
 * collapsed, false when it should be expanded.
 */
export function useRuleBasedCollapse(sceneObject: SceneObject, targetKey: string): boolean | undefined {
  const dashboard = getDashboardSceneFor(sceneObject);
  const { dashboardRules } = dashboard.useState();

  // Always call useSceneObjectState to satisfy React hooks rules (stable call order).
  const rules = dashboardRules ?? getPlaceholderRules();
  const { collapsedTargets } = useSceneObjectState(rules, { shouldActivateOrKeepAlive: true });

  if (!dashboardRules) {
    return undefined;
  }

  return collapsedTargets[targetKey];
}

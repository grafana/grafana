import { SceneObject, useSceneObjectState } from '@grafana/scenes';

import { DashboardRules } from '../rules/DashboardRules';

import { getDashboardSceneFor } from '../../utils/utils';

/** Singleton placeholder so the hook always calls useSceneObjectState (React rules). */
let placeholderRules: DashboardRules | undefined;
function getPlaceholderRules(): DashboardRules {
  if (!placeholderRules) {
    placeholderRules = new DashboardRules({ rules: [], hiddenTargets: {}, collapsedTargets: {} });
  }
  return placeholderRules;
}

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

  // Always call useSceneObjectState to satisfy React hooks rules (stable call order).
  // When dashboardRules is undefined, use a static placeholder so the hook is still invoked.
  const rules = dashboardRules ?? getPlaceholderRules();
  const { hiddenTargets } = useSceneObjectState(rules, { shouldActivateOrKeepAlive: true });

  if (!dashboardRules) {
    return undefined;
  }

  return hiddenTargets[targetKey];
}

import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { transformSceneToSaveModel } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModel';
import { getUnknownVariableStrings } from 'app/features/dashboard-scene/variables/utils';

export interface DashboardValidationIssues {
  /** Template variables referenced by queries/panels/links but not defined on the dashboard. */
  undefinedVariables: string[];
}

/** The active dashboard scene, if one is mounted. Set by DashboardScene on activation. */
function getActiveDashboardScene(): DashboardScene | undefined {
  const context = window.__grafanaSceneContext;
  return context instanceof DashboardScene ? context : undefined;
}

/**
 * Deterministically checks a freshly generated dashboard for problems the build
 * agent commonly leaves behind. Currently: queries (and other fields) that
 * reference a template variable which was never defined on the dashboard —
 * reusing Grafana's own unknown-variable detection over the serialized model,
 * so built-in variables ($__interval, $__rate_interval, …) are excluded.
 *
 * Defaults to the active dashboard scene so callers can run it right after a
 * build completes; pass a scene explicitly in tests.
 */
export function validateGeneratedDashboard(scene = getActiveDashboardScene()): DashboardValidationIssues {
  if (!scene) {
    return { undefinedVariables: [] };
  }

  const variables = sceneGraph.getVariables(scene).state.variables;
  const model = transformSceneToSaveModel(scene);
  return { undefinedVariables: getUnknownVariableStrings(variables, model) };
}

import { sceneGraph } from '@grafana/scenes';

import type { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { getUnknownVariableStrings } from '../variables/utils';

export interface DashboardValidationIssues {
  /** Template variables referenced by queries/panels/links but not defined on the dashboard. */
  undefinedVariables: string[];
}

/**
 * Deterministically checks a dashboard scene for problems that commonly slip
 * through when a dashboard is built programmatically (e.g. by the assistant).
 * Currently: queries (and other fields) that reference a template variable
 * which was never defined on the dashboard — reusing Grafana's own
 * unknown-variable detection over the serialized model, so built-in variables
 * ($__interval, $__rate_interval, …) are excluded.
 *
 * Shared between the dashboard mutation API's VALIDATE_DASHBOARD command (so
 * the assistant can self-check any dashboard it builds) and the wizard's
 * post-build backstop.
 */
export function getDashboardValidationIssues(scene: DashboardScene): DashboardValidationIssues {
  const variables = sceneGraph.getVariables(scene).state.variables;
  const model = transformSceneToSaveModel(scene);
  return { undefinedVariables: getUnknownVariableStrings(variables, model) };
}

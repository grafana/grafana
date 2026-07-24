import { type SceneObject, SceneVariableSet } from '@grafana/scenes';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

/**
 * Moves the section-level variables of items that are about to be dissolved during ungrouping
 * up one level, to the object holding the layout (dashboard, row or tab), instead of losing them
 */
export function moveSectionVariablesUp(items: SceneObject[], layout: DashboardLayoutManager) {
  const variables = items.flatMap((item) => item.state.$variables?.state.variables ?? []);
  const target = layout.parent;

  if (variables.length === 0 || !target) {
    return;
  }

  for (const variable of variables) {
    variable.clearParent();
  }

  const targetVariableSet = target.state.$variables;

  if (targetVariableSet instanceof SceneVariableSet) {
    targetVariableSet.setState({ variables: [...targetVariableSet.state.variables, ...variables] });
  } else {
    target.setState({ $variables: new SceneVariableSet({ variables }) });
  }
}

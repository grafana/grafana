import { type SceneObject, SceneVariableSet } from '@grafana/scenes';

import { filterSectionRepeatLocalVariables } from '../../variables/utils';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

/**
 * Moves the section-level variables of items that are about to be dissolved during ungrouping
 * up one level, to the object holding the layout (dashboard, row or tab), instead of losing them
 */
export function moveSectionVariablesUp(items: SceneObject[], layout: DashboardLayoutManager) {
  // Repeater-injected local values are stripped: lifting them would shadow
  // the real template variable of the same name on the parent
  const variables = items.flatMap((item) => {
    const variableSet = item.state.$variables;
    return variableSet ? filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet) : [];
  });
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

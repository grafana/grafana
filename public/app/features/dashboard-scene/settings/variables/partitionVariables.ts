import { VariableHide } from '@grafana/data';
import { type SceneVariable } from '@grafana/scenes';

import { isEditableVariableType, isVariableEditable } from './utils';

export function partitionVariablesByEditability(variables: SceneVariable[]) {
  const editable: SceneVariable[] = [];
  const nonEditable: SceneVariable[] = [];

  for (const variable of variables) {
    (isVariableEditable(variable) ? editable : nonEditable).push(variable);
  }

  return { editable, nonEditable };
}

export function partitionVariablesByDisplay(variables: SceneVariable[]) {
  const visible: SceneVariable[] = [];
  const controlsMenu: SceneVariable[] = [];
  const hidden: SceneVariable[] = [];

  for (const variable of variables) {
    if (!isEditableVariableType(variable.state.type)) {
      continue;
    }

    switch (variable.state.hide) {
      case VariableHide.hideVariable:
        hidden.push(variable);
        break;
      case VariableHide.inControlsMenu:
        controlsMenu.push(variable);
        break;
      default:
        visible.push(variable);
    }
  }

  return { visible, controlsMenu, hidden };
}

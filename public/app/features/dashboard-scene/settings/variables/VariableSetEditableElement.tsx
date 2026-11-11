import { t } from '@grafana/i18n';
import { type SceneObject, type SceneVariableSet, sceneUtils } from '@grafana/scenes';

import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
  isEditableDashboardElement,
} from '../../scene/types/EditableDashboardElement';
import { filterSectionRepeatLocalVariables } from '../../variables/utils';

import { partitionVariablesByDisplay } from './partitionVariables';
import { isVariableEditable } from './utils';

export class VariableSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private set: SceneVariableSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.variable-set', 'Variables'),
      icon: 'gf-variable',
      instanceName: t('dashboard.sidebar.elements.variable-set', 'Variables'),
    };
  }

  public getOutlineChildren() {
    const variables = filterSectionRepeatLocalVariables(this.set.state.variables, this.set).filter(
      (variable) => isVariableEditable(variable) && !sceneUtils.isAdHocVariable(variable)
    );

    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(variables);
    return [...visible, ...controlsMenu, ...hidden];
  }

  public scrollIntoView() {
    let current: SceneObject | undefined = this.set.parent;
    while (current) {
      if (isEditableDashboardElement(current) && current.scrollIntoView) {
        current.scrollIntoView();
        return;
      }
      current = current.parent;
    }
  }
}

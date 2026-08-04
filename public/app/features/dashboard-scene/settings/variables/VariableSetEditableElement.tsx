import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneObject, type SceneVariableSet, sceneUtils } from '@grafana/scenes';

import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
  isEditableDashboardElement,
} from '../../scene/types/EditableDashboardElement';
import { partitionVariablesByDisplay } from '../../sidebar/dashboard/DashboardVariablesList';
import { filterSectionRepeatLocalVariables } from '../../variables/utils';

import { isVariableEditable } from './utils';

export class VariableSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private set: SceneVariableSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.variable-set', 'Variables'),
      icon: 'x',
      instanceName: t('dashboard.sidebar.elements.variable-set', 'Variables'),
    };
  }

  public getOutlineChildren() {
    let variables = filterSectionRepeatLocalVariables(this.set.state.variables, this.set).filter((variable) =>
      isVariableEditable(variable)
    );

    if (config.featureToggles.dashboardUnifiedDrilldownControls) {
      variables = variables.filter((variable) => !sceneUtils.isAdHocVariable(variable));
    }

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

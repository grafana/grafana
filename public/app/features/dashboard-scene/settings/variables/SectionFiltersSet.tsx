import { t } from '@grafana/i18n';
import {
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
  sceneUtils,
} from '@grafana/scenes';

import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { partitionVariablesByDisplay } from '../../sidebar/dashboard/DashboardVariablesList';
import { filterSectionRepeatLocalVariables } from '../../variables/utils';

export interface SectionFiltersSetState extends SceneObjectState {
  sectionRef: SceneObjectRef<SceneObject>;
}

export class SectionFiltersSet extends SceneObjectBase<SectionFiltersSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(state: SectionFiltersSetState) {
    super({
      ...state,
      key: `section-filters-set-${state.sectionRef.resolve().state.key}`,
    });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.section-filters-set', 'Filters'),
      icon: 'filter',
      instanceName: t('dashboard.sidebar.elements.section-filters-set', 'Filters'),
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(this.getAdhocVariables());
    return [...visible, ...controlsMenu, ...hidden];
  }

  private getAdhocVariables(): SceneVariable[] {
    const sectionOwner = this.state.sectionRef.resolve();
    const variableSet = sectionOwner.state.$variables;
    if (!(variableSet instanceof SceneVariableSet)) {
      return [];
    }
    return filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet).filter(
      sceneUtils.isAdHocVariable
    );
  }
}
